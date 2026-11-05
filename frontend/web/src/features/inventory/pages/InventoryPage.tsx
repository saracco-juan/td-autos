import Button from '../../../components/Buttons/Button'
import ButtonLink from '../../../components/Buttons/ButtonLink'
import type { ReactNode } from 'react'
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import alertStyles from "../../../styles/alert.module.css";
import tableStyles from "../../../styles/dataTable.module.css";
import ErrorState, { type ErrorKind } from "../../../components/ErrorState/ErrorState";
import ListFooter from "../../../components/ListFooter/ListFooter";
import ResultsPagination from "../../../components/Pagination/ResultsPagination";
import ScrollArea from "../../../components/ScrollArea/ScrollArea";
import screenStyles from "../../../styles/screen.module.css";
import usePagedItems from "../../../hooks/usePagedItems";
import { HttpError, NetworkError } from "../../../lib/http";
import SessionLoading from "../../auth/session/components/SessionLoading";
import { deleteVehicle, fetchVehicles } from "../api/client";
import {
  inactiveSubscription,
  type InactiveSubscription,
} from "../model/inactiveSubscription";
import styles from "./InventoryPage.module.css";
import type { InventoryLocationState } from "../model/inventoryRoutes";
import SubscriptionBlockedNotice from "../components/SubscriptionBlockedNotice";
import type { Vehiculo } from "../model/types";
import { searchInventory } from "../model/searchInventory";
import VehicleRow from "../components/VehicleRow";
import rowStyles from "../components/VehicleRow.module.css";

type LoadState =
  | "loading"
  | "ready"
  | { error: ErrorKind }
  | { blocked: InactiveSubscription };

function PageHeader({ subtitle, search }: { subtitle: string; search?: ReactNode }) {
  return (
    <div className={styles.header}>
      <div className={styles.headerContent}>
        <p className={screenStyles.eyebrow}>INVENTARIO</p>
        <h1 className={screenStyles.title}>Inventario</h1>
        <p className={styles.subtitle}>{subtitle}</p>
      </div>
      {search}
    </div>
  );
}

const REMOVED_NOTICE = "Eliminaste el vehículo.";

// "Mostrar" options (docs/design.md): the page size is the dealer's choice, never the screen's.
const PAGE_SIZES = [10, 25, 50];

// The message the form leaves in the navigation state (saved or edited); anything else is ignored.
function noticeFrom(state: unknown): string | null {
  const notice = (state as InventoryLocationState | null)?.notice;
  return typeof notice === "string" ? notice : null;
}

// Dealer inventory (Figma 38:884, UH-21): the dealer's vehicles with EDITAR and ELIMINAR, and the load action.
// IMPORTAR XLSX opens the import (UH-22); SUSCRIPCIÓN of the frame waits for its own story.
export default function InventoryPage() {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [vehicles, setVehicles] = useState<Vehiculo[]>([]);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const pendingDelete = useRef(false);
  const [failedId, setFailedId] = useState<number | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  // Success message of the last action: a save that brought the dealer here, or a delete done on this page.
  const [notice, setNotice] = useState<string | null>(() =>
    noticeFrom(location.state),
  );
  const noticeRef = useRef<HTMLParagraphElement>(null);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
  const [query, setQuery] = useState('');
  const filteredVehicles = searchInventory(vehicles, query);
  const { page, lastPage, setPage, pageItems } = usePagedItems(
    filteredVehicles,
    pageSize,
  );
  const changePageSize = (size: number) => {
    setPageSize(size);
    setPage(1);
  };

  // The message lives in the history entry, which a reload keeps: take it out so it is shown once.
  useEffect(() => {
    if (noticeFrom(location.state) !== null)
      navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  // `isCancelled` lets the effect drop the answer of a page that is gone.
  const loadList = useCallback((isCancelled: () => boolean = () => false) => {
    fetchVehicles()
      .then((list) => {
        if (isCancelled()) return;
        setVehicles(list);
        setLoadState("ready");
      })
      .catch((error: unknown) => {
        if (isCancelled()) return;
        const blocked = inactiveSubscription(error);
        setLoadState(
          blocked
            ? { blocked }
            : { error: error instanceof NetworkError ? "network" : "server" },
        );
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadList(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [loadList]);

  const retry = () => {
    setLoadState("loading");
    loadList();
  };

  // The message takes the focus once it is on screen (after a delete the row that held it is gone), so the result is announced.
  const ready = loadState === "ready";
  useEffect(() => {
    if (notice && ready) noticeRef.current?.focus();
  }, [notice, ready]);

  const removeRow = (id: number) => {
    setVehicles((current) => current.filter((vehicle) => vehicle.id !== id));
    setNotice(REMOVED_NOTICE);
  };

  const confirmDelete = async (id: number) => {
    if (pendingDelete.current) return;
    pendingDelete.current = true;
    setNotice(null);
    setFailedId(null);
    setDeletingId(id);
    try {
      await deleteVehicle(id);
      removeRow(id);
    } catch (error) {
      // A 404 means the vehicle is already gone: the list was stale, not the delete.
      const blocked = inactiveSubscription(error);
      if (blocked) setLoadState({ blocked });
      else if (error instanceof HttpError && error.status === 404)
        removeRow(id);
      else setFailedId(id);
    } finally {
      pendingDelete.current = false;
      setDeletingId(null);
    }
  };

  // The loader and the error are direct children of the content area so they are centered there.
  if (loadState === "loading") return <SessionLoading />;
  if (typeof loadState === "object" && "blocked" in loadState) {
    return (
      <div className={screenStyles.page}>
        <PageHeader subtitle="Inactiva · funciones bloqueadas" />
        <SubscriptionBlockedNotice info={loadState.blocked} />
      </div>
    );
  }
  if (typeof loadState === "object")
    return <ErrorState kind={loadState.error} onRetry={retry} />;

  return (
    // Same column and table as the admin dealers list (components/dataTable.module.css).
    <div
      className={`${screenStyles.page} ${screenStyles.fill} ${tableStyles.column} ${rowStyles.inventoryColumn}`}
    >
      <PageHeader
        subtitle="Activa · funciones habilitadas"
        search={vehicles.length > 0 ? (
          <label className={styles.search}>
            <span>Buscar vehículos</span>
            <input
              type="search"
              aria-label="Buscar vehículos"
              placeholder="Marca, modelo, versión, año o patente"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
            />
          </label>
        ) : undefined}
      />
      <section
        className={styles.card}
        aria-labelledby="inventory-inclusion-title"
      >
        <h2 id="inventory-inclusion-title" className={styles.cardTitle}>
          Inclusión automática
        </h2>
        <p className={styles.cardBody}>
          Las unidades guardadas participan directamente en búsquedas y
          recomendaciones. No hay publicación manual, pausa ni archivo de
          vigencia.
        </p>
      </section>
      {notice ? (
        <p
          ref={noticeRef}
          tabIndex={-1}
          role="status"
          className={`${alertStyles.notice} ${styles.message}`}
        >
          {notice}
        </p>
      ) : null}
      <div className={tableStyles.block}>
        {vehicles.length === 0 ? (
          <p className={styles.empty}>Todavía no cargaste vehículos.</p>
        ) : filteredVehicles.length === 0 ? (
          <div className={styles.noResults} role="status">
            <p className={styles.empty}>No encontramos vehículos con esa búsqueda.</p>
            <Button variant="secondary" onClick={() => setQuery('')}>
              Limpiar búsqueda
            </Button>
          </div>
        ) : (
          <ScrollArea
            label="Vehículos del inventario"
            fill
            className={tableStyles.wrap}
            viewportClassName={tableStyles.viewport}
          >
            <table className={tableStyles.table} aria-label="Inventario">
              {/* Fixed column widths: columns never depend on the rows of the current page. */}
              <colgroup>
                <col className={rowStyles.colName} />
                <col className={rowStyles.colPlate} />
                <col className={rowStyles.colPhotos} />
                <col className={rowStyles.colKm} />
                <col className={rowStyles.colPrice} />
                <col className={rowStyles.colPlace} />
                <col className={rowStyles.colActions} />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">Vehículo</th>
                  <th scope="col" className={rowStyles.colPlate}>
                    Patente
                  </th>
                  <th scope="col" className={rowStyles.colPhotos}>
                    Imágenes
                  </th>
                  <th scope="col">Kilómetros</th>
                  <th scope="col">Precio</th>
                  <th scope="col" className={rowStyles.colPlace}>
                    Ubicación
                  </th>
                  <th scope="col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((vehicle) => (
                  <VehicleRow
                    key={vehicle.id}
                    vehicle={vehicle}
                    deleting={deletingId === vehicle.id}
                    failed={failedId === vehicle.id}
                    locked={deletingId !== null}
                    onDelete={() => confirmDelete(vehicle.id)}
                  />
                ))}
              </tbody>
            </table>
          </ScrollArea>
        )}
        <ListFooter
          actions={
            <>
              <ButtonLink
                to="/concesionaria/inventario/nuevo"
                variant="primary" className={`${styles.load}`}
              >
                CARGAR VEHÍCULO
              </ButtonLink>
              <ButtonLink
                to="/concesionaria/inventario/importar"
                variant="secondary" className={`${styles.load}`}
              >
                IMPORTAR XLSX
              </ButtonLink>
            </>
          }
        >
          {filteredVehicles.length > PAGE_SIZES[0] ? (
            <ResultsPagination
              page={page}
              lastPage={lastPage}
              onChange={setPage}
              pageSize={pageSize}
              pageSizeOptions={PAGE_SIZES}
              onPageSizeChange={changePageSize}
            />
          ) : null}
        </ListFooter>
      </div>
    </div>
  );
}
