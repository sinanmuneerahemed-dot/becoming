importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyDEjMFRqLcJg-FDUfKGg-FJSLLTLzDblRk",
    authDomain: "webecomming.firebaseapp.com",
    projectId: "webecomming",
    storageBucket: "webecomming.firebasestorage.app",
    messagingSenderId: "329368280885",
    appId: "1:329368280885:web:2baf06c5f840747949367c",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);

    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/icon-192x192.png',
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});
