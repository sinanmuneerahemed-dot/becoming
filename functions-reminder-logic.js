const functions = require("firebase-functions");
admin.initializeApp();

/**
 * NOTE: Use your VAPID Private Key (NCgz7OvAMQl1m2OJunAaKlQYgl8Xj5VjRE-DbfH1kCA) 
 * if you are using a custom push service instead of Firebase Admin.
 * 
 * Scheduled function to send personalized reminders daily at 8 PM.
 * Deploy via Firebase CLI: firebase deploy --only functions
 */
exports.sendDailyReminder = functions.pubsub
    .schedule("0 20 * * *") // 8:00 PM every day
    .timeZone("Asia/Kolkata") // Replace with user's primary timezone or implement per-user timezone logic
    .onRun(async (context) => {
        const db = admin.firestore();
        const usersSnap = await db.collection("users").get();

        const notifications = [];

        usersSnap.forEach((userDoc) => {
            const userData = userDoc.data();
            const tokens = userData.fcmTokens || [];
            const name = userData.displayName || "Friend";

            if (tokens.length > 0) {
                const message = {
                    notification: {
                        title: `Hey ${name}!`,
                        body: "Remember to get back to becoming. Your 7-day direction is waiting for your progress.",
                    },
                    tokens: tokens,
                };

                notifications.push(admin.messaging().sendMulticast(message));
            }
        });

        try {
            const results = await Promise.all(notifications);
            console.log(`Successfully sent ${results.length} notification batches.`);
        } catch (error) {
            console.error("Error sending notifications:", error);
        }

        return null;
    });
