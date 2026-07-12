import { dumpDatabase } from "./actions";
export const dynamic = "force-dynamic";

export default async function TestDBPage() {
  const data = await dumpDatabase();
  
  return (
    <div style={{ padding: 20 }}>
      <h1>Database Dump</h1>
      <pre style={{ background: "#f0f0f0", padding: 20, borderRadius: 8 }}>
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
