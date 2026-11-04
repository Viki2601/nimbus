import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import { getMongoClient } from "@/lib/mongodb";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: MongoDBAdapter(() => getMongoClient(), { databaseName: process.env.MONGODB_DB?.trim() || undefined, }),
  providers: [Google],
  session: { strategy: "jwt" },
  callbacks: {
    authorized({ auth, request }) {
      const isLoginPage = request.nextUrl.pathname === "/login";
      const isAuthenticated = Boolean(auth?.user);

      if (isLoginPage) {
        return isAuthenticated ? Response.redirect(new URL("/", request.url)) : true;
      }

      return isAuthenticated ? true : Response.redirect(new URL("/login", request.url));
    },
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
  },
});