import { Injectable, OnModuleInit } from "@nestjs/common";
import * as admin from "firebase-admin";
import { loadEnv } from "../../config/env";

@Injectable()
export class FirebaseService implements OnModuleInit {
  onModuleInit() {
    // In tests FirebaseService is overridden with a mock; skip real init so
    // stub/absent Firebase credentials do not crash app bootstrap (CI note).
    if (process.env.NODE_ENV === "test") return;
    if (admin.apps.length) return;
    const env = loadEnv();
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
    });
  }
  async verifyIdToken(token: string) {
    const d = await admin.auth().verifyIdToken(token);
    return { uid: d.uid, phone: d.phone_number, email: d.email };
  }
}
