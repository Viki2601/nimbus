import { auth } from "@/../auth";
import { settingsCollection, type UserSettings } from "@/lib/user-data";

const DEFAULT_PREFERENCES: UserSettings["preferences"] = {
  appearance: "light",
  compactMode: false,
  notifications: true,
  language: "en",
};

const DEFAULT_PROFILE: NonNullable<UserSettings["profile"]> = {
  fullName: "",
  preferredName: "",
  occupation: "",
  instructions: "",
  avatar: null,
};
const MAX_AVATAR_BYTES = 512 * 1024;
const PROFILE_FIELD_LIMITS = {
  fullName: 80,
  preferredName: 40,
  occupation: 120,
  instructions: 1500,
} as const;

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    const settings = await settingsCollection().findOne({ userId });
    return Response.json(
      {
        profile: {
          ...DEFAULT_PROFILE,
          fullName: settings?.profile?.fullName ?? session?.user?.name ?? "",
          ...settings?.profile,
        },
        preferences: settings?.preferences ?? DEFAULT_PREFERENCES,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("Could not load user settings.", error);
    return Response.json({ error: "Settings are unavailable." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || (!("preferences" in body) && !("profile" in body))) {
    return Response.json({ error: "Profile or preferences are required." }, { status: 400 });
  }

  const updates: Partial<UserSettings["preferences"]> = {};
  if ("preferences" in body) {
    const values = body.preferences;
    if (typeof values !== "object" || values === null || Array.isArray(values)) {
      return Response.json({ error: "Preferences must be an object." }, { status: 400 });
    }

    for (const [key, value] of Object.entries(values)) {
      if (key === "appearance" && value === "light") {
        updates.appearance = value;
      } else if (key === "compactMode" && typeof value === "boolean") {
        updates.compactMode = value;
      } else if (key === "notifications" && typeof value === "boolean") {
        updates.notifications = value;
      } else if (key === "language" && typeof value === "string" && /^[a-z]{2}(?:-[A-Z]{2})?$/.test(value)) {
        updates.language = value;
      } else {
        return Response.json({ error: `Invalid preference: ${key}.` }, { status: 400 });
      }
    }
  }

  const profileUpdates: Partial<NonNullable<UserSettings["profile"]>> = {};
  if ("profile" in body) {
    const values = body.profile;
    if (typeof values !== "object" || values === null || Array.isArray(values)) {
      return Response.json({ error: "Profile must be an object." }, { status: 400 });
    }

    for (const [key, value] of Object.entries(values)) {
      if (Object.prototype.hasOwnProperty.call(PROFILE_FIELD_LIMITS, key)) {
        const limit = PROFILE_FIELD_LIMITS[key as keyof typeof PROFILE_FIELD_LIMITS];
        if (typeof value !== "string" || value.trim().length > limit) {
          return Response.json({ error: `Invalid profile field: ${key}.` }, { status: 400 });
        }
        profileUpdates[key as keyof typeof PROFILE_FIELD_LIMITS] = value.trim();
      } else if (key === "avatar" && (value === null || typeof value === "string")) {
        if (typeof value === "string") {
          const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
          const encoded = match?.[2];
          const byteLength = encoded
            ? Math.floor((encoded.length * 3) / 4) - (encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0)
            : Infinity;
          if (!match || !encoded || encoded.length % 4 !== 0 || byteLength > MAX_AVATAR_BYTES) {
            return Response.json({ error: "Avatar must be a PNG, JPEG, or WebP image up to 512 KB." }, { status: 400 });
          }
        }
        profileUpdates.avatar = value;
      } else {
        return Response.json({ error: `Invalid profile field: ${key}.` }, { status: 400 });
      }
    }
  }

  if (Object.keys(updates).length === 0 && Object.keys(profileUpdates).length === 0) {
    return Response.json({ error: "At least one valid profile field or preference is required." }, { status: 400 });
  }

  try {
    const set: Record<string, unknown> = {
      userId,
      updatedAt: new Date(),
    };
    for (const [key, value] of Object.entries(updates)) {
      set[`preferences.${key}`] = value;
    }
    for (const [key, value] of Object.entries(profileUpdates)) {
      set[`profile.${key}`] = value;
    }

    await settingsCollection().updateOne({ userId }, { $set: set }, { upsert: true });
    const settings = await settingsCollection().findOne({ userId });

    return Response.json({
      profile: {
        ...DEFAULT_PROFILE,
        fullName: settings?.profile?.fullName ?? session?.user?.name ?? "",
        ...settings?.profile,
      },
      preferences: settings?.preferences ?? DEFAULT_PREFERENCES,
    });
  } catch (error) {
    console.error("Could not save user settings.", error);
    return Response.json({ error: "Settings could not be saved." }, { status: 503 });
  }
}
