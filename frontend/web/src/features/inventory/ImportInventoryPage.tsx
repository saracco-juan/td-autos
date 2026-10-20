import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import alertStyles from "../../components/alert.module.css";
import buttonStyles from "../../components/button.module.css";
import barStyles from "../../components/checklist/pinnedBar.module.css";
import ScrollArea from "../../components/ScrollArea";
import { HttpError } from "../../lib/http";
import SessionLoading from "../auth/session/SessionLoading";
import { confirmImport, previewImport } from "./api";
import {
  inactiveSubscription,
  type InactiveSubscription,
} from "./inactiveSubscription";
import { importFailureFrom, type ImportFailure } from "./importErrors";
import { appliedNotice, previewSummary } from "./importMessages";
import styles from "./ImportInventoryPage.module.css";
import { goToInventory, INVENTORY_PATH } from "./inventoryRoutes";
import SubscriptionBlockedNotice from "./SubscriptionBlockedNotice";
import type { ImportCounts } from "./types";
import VehicleFormPage from "./VehicleFormPage";

type Preview = "none" | "loading" | ImportCounts;

const FORMAT_HELP =
  "Columnas: patente, marca, modelo, version (opcional), anio, kilometraje, precio, transmision, combustible, carroceria, ubicacion, descripcion (opcional) y fotos. " +
  "Separá las columnas con ; o ,. En fotos, poné de 7 a 20 URLs http o https separadas por |. Hasta 500 filas y 2 MB.";

const MATCHING_HELP = [
  "Conservá también todas las columnas nuevas de la plantilla: moneda (ARS o USD), plazas (entero positivo, incluye conductor), motor, turbo, potencia (entero positivo), potencia_unidad (CV, HP o kW), consumo_urbano, consumo_ruta y equipamiento.",
  "Turbo y cada dato de seguridad y confort requieren sí o no. Vacío no significa no. Android Auto o Apple CarPlay es una sola respuesta: sí si tiene al menos uno.",
  "Consumos en L/100 km, mayores que cero, con punto decimal y hasta dos decimales. Son obligatorios para nafta y diesel; opcionales para gnc, hibrido y electrico. Transmisión: manual o automatica. Carrocería: el nombre de la lista del alta manual.",
  "La fila de ejemplo contiene datos ficticios: reemplazalos por los de cada vehículo. Descargá la plantilla actualizada; las versiones incompletas se rechazan sin aplicar cambios.",
];

// Import vehicles from a CSV (Figma 38:1005, CU-20): picking the file requests the preview; confirming applies the same file.
export default function ImportInventoryPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview>("none");
  const [failure, setFailure] = useState<ImportFailure | null>(null);
  const [blocked, setBlocked] = useState<InactiveSubscription | null>(null);
  const [confirming, setConfirming] = useState(false);
  const failureRef = useRef<HTMLDivElement>(null);
  // The latest picked file: the answer of an earlier one is dropped.
  const currentFile = useRef<File | null>(null);

  // The errors take the focus once shown, so the result is announced.
  useEffect(() => {
    if (failure) failureRef.current?.focus();
  }, [failure]);

  // An inactive subscription gets its own box with the way to renew; any other failure is the import's own.
  const showFailure = (error: unknown) => {
    const inactive = inactiveSubscription(error);
    if (inactive) setBlocked(inactive);
    else setFailure(importFailureFrom(error));
  };

  const pickFile = async (picked: File) => {
    currentFile.current = picked;
    setFile(picked);
    setFailure(null);
    setBlocked(null);
    setPreview("loading");
    try {
      const counts = await previewImport(picked);
      if (currentFile.current === picked) setPreview(counts);
    } catch (error) {
      if (currentFile.current !== picked) return;
      setPreview("none");
      showFailure(error);
    }
  };

  const confirm = async () => {
    if (!file) return;
    setFailure(null);
    setBlocked(null);
    setConfirming(true);
    try {
      const counts = await confirmImport(file);
      goToInventory(navigate, appliedNotice(counts));
    } catch (error) {
      // A 422 means the file no longer passes (e.g. a plate taken meanwhile): the preview is stale. Other failures can be retried.
      if (error instanceof HttpError && error.status === 422)
        setPreview("none");
      showFailure(error);
      setConfirming(false);
    }
  };

  const ready = typeof preview === "object";

  return (
    <VehicleFormPage
      title="Importar CSV"
      subtitle="Subí un archivo para cargar o actualizar varios vehículos a la vez."
      actions={
        <div className={barStyles.actions}>
          <Link
            to={INVENTORY_PATH}
            className={`${buttonStyles.button} ${buttonStyles.secondary} ${barStyles.action}`}
          >
            VOLVER AL INVENTARIO
          </Link>
          <button
            type="button"
            disabled={!ready || confirming}
            aria-busy={confirming}
            className={`${buttonStyles.button} ${buttonStyles.success} ${barStyles.actionWide}`}
            onClick={() => void confirm()}
          >
            {confirming ? "IMPORTANDO…" : "CONFIRMAR IMPORTACIÓN"}
          </button>
        </div>
      }
    >
      <section className={styles.card} aria-labelledby="import-format-title">
        <h2 id="import-format-title" className={styles.cardTitle}>
          Formato del archivo
        </h2>
        <p className={styles.cardBody}>
          Cada fila necesita patente, marca, modelo, año y al menos 7 URLs de
          imágenes públicas. La patente identifica al vehículo: si ya existe se
          actualiza, si no existe se crea.
        </p>
        <p className={styles.cardBody}>{FORMAT_HELP}</p>
        {MATCHING_HELP.map((help) => (
          <p key={help} className={styles.cardBody}>{help}</p>
        ))}
        <a
          href="/plantilla-inventario.csv"
          download="plantilla-inventario.csv"
          className={`${buttonStyles.button} ${buttonStyles.secondary} ${styles.template}`}
        >
          DESCARGAR PLANTILLA
        </a>
      </section>
      <div className={styles.fileRow}>
        <div className={styles.fileField}>
          <span className={styles.fileLabel}>Archivo CSV</span>
          <span className={styles.fileName}>
            {file?.name ?? "Ningún archivo seleccionado"}
          </span>
        </div>
        <label
          className={`${buttonStyles.button} ${buttonStyles.secondary} ${styles.pick}`}
        >
          SELECCIONAR ARCHIVO
          <input
            type="file"
            aria-label="Archivo CSV"
            accept=".csv,text/csv"
            className={styles.fileInput}
            disabled={confirming}
            onChange={(event) => {
              const picked = event.target.files?.[0];
              // The same file can be picked again after fixing it.
              event.target.value = "";
              if (picked) void pickFile(picked);
            }}
          />
        </label>
      </div>
      {preview === "loading" ? (
        <section className={`${styles.card} ${styles.loadingCard}`}>
          <SessionLoading />
        </section>
      ) : null}
      {ready ? (
        <section className={styles.card} aria-labelledby="import-preview-title">
          <h2 id="import-preview-title" className={styles.cardTitle}>
            Vista previa
          </h2>
          <p className={styles.cardBody}>{previewSummary(preview)}</p>
        </section>
      ) : null}
      {blocked ? <SubscriptionBlockedNotice info={blocked} compact /> : null}
      {failure ? (
        <div
          ref={failureRef}
          tabIndex={-1}
          role="alert"
          className={`${alertStyles.alert} ${styles.failure}`}
        >
          <p className={styles.failureMessage}>{failure.message}</p>
          {failure.rows.length > 0 ? (
            <ScrollArea label="Filas con error" offset={640}>
              <ul className={styles.failureRows}>
                {failure.rows.map((row, index) => (
                  <li key={index}>{row}</li>
                ))}
              </ul>
            </ScrollArea>
          ) : null}
        </div>
      ) : null}
    </VehicleFormPage>
  );
}
