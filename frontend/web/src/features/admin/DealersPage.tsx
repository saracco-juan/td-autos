import { useState } from "react";
import { Link } from "react-router";
import buttonStyles from "../../components/button.module.css";
import ErrorState from "../../components/ErrorState";
import ListFooter from "../../components/ListFooter";
import Pagination from "../../components/Pagination";
import ScrollArea from "../../components/ScrollArea";
import screenStyles from "../../components/screen.module.css";
import usePagedItems from "../../components/usePagedItems";
import SessionLoading from "../auth/session/SessionLoading";
import styles from "./admin.module.css";
import {
  accountState,
  dealerLocation,
  hasRejectedReceipt,
  receiptTarget,
} from "./format";
import StateTag from "./StateTag";
import type { AdminDealerRow } from "./types";
import { useDealerDirectory } from "./useDealerDirectory";

// "Mostrar" options; the page size is the user's choice, never the screen's, so zooming does not change it (DESIGN.md).
const PAGE_SIZES = [10, 25, 50];

function registeredCount(count: number): string {
  return count === 1
    ? "1 concesionaria registrada"
    : `${count} concesionarias registradas`;
}

function DealerRow({ dealer }: { dealer: AdminDealerRow }) {
  const state = accountState(dealer.estado_alta, dealer.suscripcion_estado);
  const receiptId = receiptTarget(dealer);

  return (
    <tr>
      <th
        scope="row"
        className={`${styles.dealerName} ${styles.truncate}`}
        title={dealer.nombre}
      >
        {dealer.nombre}
      </th>
      <td
        className={`${styles.muted} ${styles.truncate}`}
        title={dealerLocation(dealer)}
      >
        {dealerLocation(dealer)}
      </td>
      <td
        className={`${styles.muted} ${styles.truncate}`}
        title={dealer.contacto.email ?? undefined}
      >
        {dealer.contacto.email}
      </td>
      <td>
        <div className={styles.stateCell}>
          <span className={styles.state} data-tone={state.tone}>
            {state.label}
          </span>
          {state.tag ? <StateTag tag={state.tag} /> : null}
          {hasRejectedReceipt(dealer) ? (
            <StateTag
              tag={{ label: "Comprobante rechazado", tone: "rejected" }}
            />
          ) : null}
        </div>
      </td>
      <td>
        <div className={styles.actions}>
          <Link
            to={`/admin/concesionarias/${dealer.id}`}
            aria-label={`Editar ${dealer.nombre}`}
            className={`${buttonStyles.button} ${buttonStyles.secondary} ${styles.rowAction}`}
          >
            EDITAR
          </Link>
          {receiptId === null ? (
            <span className={styles.muted}>Sin comprobante</span>
          ) : (
            <Link
              to={`/admin/comprobantes/${receiptId}`}
              aria-label={`Ver comprobante de ${dealer.nombre}`}
              className={`${buttonStyles.button} ${buttonStyles.secondary} ${styles.rowAction}`}
            >
              VER COMPROBANTE
            </Link>
          )}
        </div>
      </td>
    </tr>
  );
}

// Dealer list (Figma 38:1037, UH19): dealers waiting for a review first, as the API orders them.
// EDITAR opens the dealer page (UH27).
export default function DealersPage() {
  const { state, retry } = useDealerDirectory();
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
  const dealers =
    state === "loading" || "error" in state ? [] : state.data.concesionarias;
  const { page, lastPage, setPage, pageItems } = usePagedItems(
    dealers,
    pageSize,
  );
  const changePageSize = (size: number) => {
    setPageSize(size);
    setPage(1);
  };

  if (state === "loading") return <SessionLoading />;
  if ("error" in state)
    return <ErrorState kind={state.error} onRetry={retry} />;

  return (
    // A centered column as wide as the table: title, table and pager share its edges; the table box takes the free height.
    <div className={`${screenStyles.page} ${screenStyles.fill} ${styles.dealersColumn}`}>
      <div className={styles.header}>
        <p className={screenStyles.eyebrow}>ADMINISTRACIÓN</p>
        <h1 id="admin-dealers-title" className={screenStyles.title}>
          Concesionarias
        </h1>
        <p className={styles.subtitle}>{registeredCount(dealers.length)}</p>
      </div>
      {dealers.length === 0 ? (
        <p className={styles.empty}>
          Todavía no hay concesionarias registradas.
        </p>
      ) : (
        <div className={styles.tableBlock}>
        <ScrollArea
          label="Listado de concesionarias"
          fill
          className={styles.tableWrap}
          viewportClassName={styles.tableViewport}
        >
          <table
            className={styles.table}
            aria-labelledby="admin-dealers-title"
          >
            {/* Fixed column widths: columns never depend on the rows of the current page. */}
            <colgroup>
              <col className={styles.colName} />
              <col className={styles.colPlace} />
              <col className={styles.colContact} />
              <col className={styles.colState} />
              <col className={styles.colActions} />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">Concesionaria</th>
                <th scope="col">Localidad</th>
                <th scope="col">Contacto</th>
                <th scope="col">Estado</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((dealer) => (
                <DealerRow key={dealer.id} dealer={dealer} />
              ))}
            </tbody>
          </table>
        </ScrollArea>
        {dealers.length > PAGE_SIZES[0] ? (
          <ListFooter>
            <Pagination
              page={page}
              lastPage={lastPage}
              onChange={setPage}
              pageSize={pageSize}
              pageSizeOptions={PAGE_SIZES}
              onPageSizeChange={changePageSize}
            />
          </ListFooter>
        ) : null}
        </div>
      )}
    </div>
  );
}
