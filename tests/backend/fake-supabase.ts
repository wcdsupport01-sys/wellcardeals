export const actorId = "00000000-0000-0000-0000-000000000001";
export let scenario: any;
export function configure(overrides: any = {}) {
  scenario = {
    actor: { id: actorId, role: "admin", status: "approved" },
    calls: [],
    target: { id: "00000000-0000-0000-0000-000000000002", role: "agent" },
    createError: null,
    ...overrides,
  };
}
export function createClient(_url: string, _key: string) {
  return {
    auth: {
      getUser: async () => ({
        data: { user: scenario.user === null ? null : { id: actorId } },
      }),
      admin: {
        createUser: async () => {
          scenario.calls.push("createUser");
          return {
            data: {
              user: scenario.createError ? null : { id: scenario.target.id },
            },
            error: scenario.createError,
          };
        },
        updateUserById: async () => {
          scenario.calls.push("resetPassword");
          return { error: null };
        },
        deleteUser: async () => {
          scenario.calls.push("deleteUser");
          return { error: null };
        },
        listUsers: async () => {
          scenario.calls.push("listUsers");
          return { data: { users: [] } };
        },
      },
    },
    rpc: async () => ({ data: "DLR-000001", error: null }),
    from(table: string) {
      let id = "", action = "select";
      const filters: any[] = [];
      let payload: any;
      const builder: any = {
        select: () => builder,
        eq: (_name: string, value: string) => {
          if (_name === "id") id = value;
          filters.push([_name, value]);
          return builder;
        },
        is: (name: string, value: any) => {
          filters.push([name, value]);
          return builder;
        },
        maybeSingle: () => builder,
        single: () => builder,
        order: () => builder,
        limit: () => builder,
        ilike: (_name: string, value: string) => {
          scenario.calls.push(["ilike", value]);
          return builder;
        },
        upsert: () => {
          action = "upsert";
          return builder;
        },
        insert: () => {
          action = "insert";
          return builder;
        },
        update: (value: any) => {
          action = "update";
          payload = value;
          return builder;
        },
        then: (resolve: any, reject: any) => {
          scenario.calls.push([table, action, payload, filters]);
          const data = table === "cars"
            ? action === "update" && scenario.carUpdateMissing
              ? null
              : scenario.car
            : table === "profiles"
            ? id === actorId ? scenario.actor : scenario.target
            : table === "dealer_applications"
            ? {
              id: scenario.target.id,
              email: "dealer@example.test",
              status: "pending",
              business_name: "Fixture dealer",
            }
            : null;
          return Promise.resolve({
            data,
            error: null,
            count: scenario.bidCount ?? 0,
          }).then(resolve, reject);
        },
      };
      return builder;
    },
  };
}
