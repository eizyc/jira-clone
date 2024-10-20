import { Hono } from "hono";
import { ID, Query } from "node-appwrite";
import { zValidator } from "@hono/zod-validator";

import { generateInviteCode } from "@/lib/utils";
import { sessionMiddleware } from "@/lib/session-middleware";
import { DATABASE_ID, MEMBERS_ID, WORKSPACES_ID } from "@/config";
import { MemberRole } from "@/features/members/types";
import { getMember } from "@/features/members/utils";

import { Workspace } from "../types";
import { createWorkspaceSchema, updateWorkspaceSchema } from "../schemas";


const app = new Hono()
.get("/", sessionMiddleware, async (c) => {
  const user = c.get("user");
  const databases = c.get("databases");

  const members = await databases.listDocuments(
    DATABASE_ID,
    MEMBERS_ID,
    [Query.equal("userId", user.$id)]
  );

  if (members.total === 0) {
    return c.json({ data: { documents: [], total: 0 } });
  }

  const workspaceIds = members.documents.map((member) => member.workspaceId);

  const workspaces = await databases.listDocuments(
    DATABASE_ID,
    WORKSPACES_ID,
    [
      Query.orderDesc("$createdAt"),
      Query.contains("$id", workspaceIds)
    ],
  );

  return c.json({ data: workspaces });
})
.get(
  "/:workspaceId",
  sessionMiddleware,
  async (c) => {
    const user = c.get("user");
    const databases = c.get("databases");
    const { workspaceId } = c.req.param();

    const member = await getMember({
      databases,
      workspaceId,
      userId: user.$id,
    });

    if (!member) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const workspace = await databases.getDocument<Workspace>(
      DATABASE_ID,
      WORKSPACES_ID,
      workspaceId,
    );

    return c.json({ data: workspace });
  }
)
.post(
  "/",
  zValidator("form", createWorkspaceSchema),
  sessionMiddleware,
  async (c) => {
    const databases = c.get("databases");
    const user = c.get("user");

    const { name, image } = c.req.valid("form");

    let uploadedImageUrl: string | undefined;

    if (image instanceof File) {
      const { type } = image

      const arrayBuffer = await image.arrayBuffer();

      const base64Code = Buffer.from(arrayBuffer).toString("base64")

      uploadedImageUrl = `data:${type};base64,${base64Code}`;
    }

    const workspace = await databases.createDocument(
      DATABASE_ID,
      WORKSPACES_ID,
      ID.unique(),
      {
        name,
        userId: user.$id,
        imageUrl: uploadedImageUrl,
        inviteCode: generateInviteCode(6),
      },
    );

    await databases.createDocument(
      DATABASE_ID,
      MEMBERS_ID,
      ID.unique(),
      {
        userId: user.$id,
        workspaceId: workspace.$id,
        role: MemberRole.ADMIN,
      },
    );

    return c.json({ data: workspace });
  }
)
.patch(
  "/:workspaceId",
  sessionMiddleware,
  zValidator("form", updateWorkspaceSchema),
  async (c) => {
    const databases = c.get("databases");
    const user = c.get("user");

    const { workspaceId } = c.req.param();
    const { name, image } = c.req.valid("form");

    const member = await getMember({
      databases,
      workspaceId,
      userId: user.$id,
    });

    if (!member || member.role !== MemberRole.ADMIN) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    let uploadedImageUrl: string | undefined;

    if (image instanceof File) {
      const { type } = image

      const arrayBuffer = await image.arrayBuffer();

      const base64Code = Buffer.from(arrayBuffer).toString("base64")

      uploadedImageUrl = `data:${type};base64,${base64Code}`;
    } else {
      uploadedImageUrl = image;
    } 

    const workspace = await databases.updateDocument(
      DATABASE_ID,
      WORKSPACES_ID,
      workspaceId,
      {
        name,
        imageUrl: uploadedImageUrl
      }
    );

    return c.json({ data: workspace });
  }
);

export default app;
