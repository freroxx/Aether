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
    {
      toVersion: 40,
      steps: [
        addColumns({
          table: "courses",
          columns: [{ name: "resourceId", type: "string", isOptional: true }],
        }),
      ],
    },
    {
      toVersion: 41,
      steps: [
        addColumns({ table: "homework", columns: [{ name: "backgroundColor", type: "string", isOptional: true }] }),
        addColumns({
          table: "news",
          columns: [
            { name: "survey", type: "boolean", isOptional: true },
            { name: "anonymousResponse", type: "boolean", isOptional: true },
            { name: "template", type: "boolean", isOptional: true },
            { name: "sharedTemplate", type: "boolean", isOptional: true },
            { name: "creationDate", type: "number", isOptional: true },
            { name: "endDate", type: "number", isOptional: true },
          ],
        }),
        addColumns({ table: "periods", columns: [{ name: "isCurrent", type: "boolean", isOptional: true }] }),
        addColumns({
          table: "grades",
          columns: [
            { name: "statusCode", type: "string", isOptional: true },
            { name: "rawGrade", type: "string", isOptional: true },
          ],
        }),
        addColumns({ table: "delays", columns: [{ name: "justification", type: "string", isOptional: true }] }),
        addColumns({
          table: "absences",
          columns: [
            { name: "days", type: "number", isOptional: true },
            { name: "hours", type: "string", isOptional: true },
          ],
        }),
        addColumns({
          table: "punishments",
          columns: [
            { name: "schedulable", type: "boolean", isOptional: true },
            { name: "requiresParent", type: "string", isOptional: true },
            { name: "scheduleRaw", type: "string", isOptional: true },
          ],
        }),
        addColumns({
          table: "chats",
          columns: [
            { name: "unread", type: "number", isOptional: true },
            { name: "closed", type: "boolean", isOptional: true },
            { name: "labelsRaw", type: "string", isOptional: true },
          ],
        }),
        addColumns({
          table: "recipients",
          columns: [
            { name: "type", type: "string", isOptional: true },
            { name: "email", type: "string", isOptional: true },
            { name: "functionsRaw", type: "string", isOptional: true },
            { name: "withDiscussion", type: "boolean", isOptional: true },
          ],
        }),
        addColumns({
          table: "messages",
          columns: [
            { name: "seen", type: "boolean", isOptional: true },
            { name: "replyingTo", type: "string", isOptional: true },
          ],
        }),
        addColumns({
          table: "courses",
          columns: [
            { name: "subjectId", type: "string", isOptional: true },
            { name: "teacherNamesRaw", type: "string", isOptional: true },
            { name: "classroomsRaw", type: "string", isOptional: true },
            { name: "groupNamesRaw", type: "string", isOptional: true },
            { name: "num", type: "number", isOptional: true },
            { name: "detention", type: "boolean", isOptional: true },
            { name: "outing", type: "boolean", isOptional: true },
            { name: "isTest", type: "boolean", isOptional: true },
            { name: "exempted", type: "boolean", isOptional: true },
            { name: "virtualClassroomsRaw", type: "string", isOptional: true },
          ],
        }),
        addColumns({ table: "kids", columns: [{ name: "externalId", type: "string", isOptional: true }] }),
      ],
    },
  ],
});
