"use client";

import { useEffect } from "react";
import { getToken, onMessage } from "firebase/messaging";
import { getMessaging } from "firebase/messaging";
import { doc, setDoc, arrayUnion } from "firebase/firestore";
import { auth, db, app } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { toast } from "sonner";

export default function NotificationManager() {
    useEffect(() => {
        if (typeof window === "undefined" || !("Notification" in window)) return;

        const messaging = app ? getMessaging(app) : null;

        const setupNotifications = async (uid: string, displayName: string | null) => {
            try {
                const permission = await Notification.requestPermission();
                if (permission === "granted" && messaging) {
                    // vapidKey is required for FCM. The user needs to provide this or I'll use a placeholder/reminder.
                    const token = await getToken(messaging, {
                        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
                    });

                    if (token) {
                        // Save token to Firestore
                        const userRef = doc(db, "users", uid);
                        await setDoc(userRef, {
                            fcmTokens: arrayUnion(token),
                            displayName: displayName, // Ensure name is synced for personalization
                            lastTokenUpdate: new Date().toISOString(),
                        }, { merge: true });

                        console.log("Notification token registered");
                    }
                }
            } catch (error) {
                console.error("Error setting up notifications:", error);
            }
        };

        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setupNotifications(user.uid, user.displayName);
            }
        });

        if (messaging) {
            onMessage(messaging, (payload) => {
                console.log("Foreground message received:", payload);
                toast(payload.notification?.title || "New Notification", {
                    description: payload.notification?.body,
                });
            });
        }

        return () => unsubscribe();
    }, []);

    return null;
}
