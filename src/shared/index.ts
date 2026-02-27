// Re-export library components as local aliases for backward compat
export { DataTable as SharedTable } from "matchdb-component-library";
export type {
  DataTableColumn as ColumnDef,
  DataTableProps as SharedTableProps,
} from "matchdb-component-library";

export { default as PokesTable } from "./PokesTable";
export type { PokesTableProps } from "./PokesTable";
