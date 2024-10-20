import { Hono } from "hono";
import { ID } from "node-appwrite";
import { zValidator } from "@hono/zod-validator";

import { sessionMiddleware } from "@/lib/session-middleware";
import { DATABASE_ID, WORKSPACES_ID } from "@/config";

import { createWorkspaceSchema } from "../schemas";

const app = new Hono()
.get("/", sessionMiddleware, async (c) => {
  const databases = c.get("databases");

  const workspaces = await databases.listDocuments(
    DATABASE_ID,
    WORKSPACES_ID,
  );

  return c.json({ data: workspaces });
})
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
      },
    );

    return c.json({ data: workspace });
  }
)

export default app;
