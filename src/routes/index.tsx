import { createFileRoute } from "@tanstack/react-router";
import { Table } from "@/components/table/Table";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <Table />;
}
