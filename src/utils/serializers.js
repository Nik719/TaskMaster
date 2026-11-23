// Prisma `select` shapes for data that leaves the API.
// Using explicit selects (instead of returning whole rows) means a new sensitive column,
// such as passwordHash, can never leak into a response by accident.

/** A user as other people see them (assignees, comment authors, members). */
export const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  avatarUrl: true,
};

/** The signed-in user's own profile. */
export const profileSelect = {
  ...publicUserSelect,
  bio: true,
  createdAt: true,
  updatedAt: true,
};
