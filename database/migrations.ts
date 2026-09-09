import { addColumns, schemaMigrations } from "@nozbe/watermelondb/Schema/migrations";

export const migrations = schemaMigrations({
  migrations: [
    {
      toVersion: 38,
      steps: [
        addColumns({
          table: "courses",
          columns: [{ name: "contentRaw", type: "string", isOptional: true }],
        }),
      ],
    },
    {
      toVersion: 39,
      steps: [
        addColumns({
          table: "homework",
          columns: [{ name: "pronoteId", type: "string", isOptional: true }],
        }),
      ],
    },
  ],
});
