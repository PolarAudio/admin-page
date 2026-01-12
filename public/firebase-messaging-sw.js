importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBWmkv8YDOAtSqrehqEkO1vWNbBvmhs65A",
  authDomain: "booking-app-1af02.firebaseapp.com",
  projectId: "booking-app-1af02",
  storageBucket: "booking-app-1af02.firebasestorage.app",
  messagingSenderId: "909871533345",
  appId: "1:909871533345:web:939fa5b6c8203ad4308260",
  measurementId: "G-NF4XH5S2QC"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/polar.svg'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});