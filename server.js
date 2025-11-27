// standalone-backend/server.js

require('dotenv').config();

const express = require('express');
const admin = require('firebase-admin');
const bodyParser = require('body-parser');
const cors = require('cors');
const nodemailer = require('nodemailer');
const { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } = require('./googleCalendar');

// Initialize Firebase Admin SDK
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const app = express();

app.use(cors());
app.use(bodyParser.json());

const APP_ID_FOR_FIRESTORE_PATH = process.env.FIREBASE_PROJECT_ID || 'booking-app-1af02';
const ADMIN_EMAIL = 'polarsolutions.warehouse@gmail.com';

// Check for essential environment variables
if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
  console.error("ERROR: GMAIL_USER and GMAIL_PASS environment variables must be set for Nodemailer to function.");
  process.exit(1); // Exit if critical env vars are missing
}

if (!process.env.FRONTEND_URL) {
  console.warn("WARNING: FRONTEND_URL environment variable is not set. Payment confirmation links in admin emails will be incomplete.");
}

// Nodemailer transporter setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS
  }
});

const adminOnly = (req, res, next) => {
  if (req.user.email !== ADMIN_EMAIL) {
    return res.status(403).send({ error: 'Forbidden' });
  }
  next();
};

// Helper function to send booking-related emails
const sendBookingEmails = async (type, bookingData, userEmail, bookingId = null) => {
    const subjectMap = {
        create: 'Booking Creation Confirmed',
        update: 'Booking Edited',
        cancel: 'Booking Cancelled'
    };
    const subject = subjectMap[type] || 'Booking Notification';

    const bookingDetails = `
        Booking ID: ${bookingId || 'N/A'}
        User Name: ${bookingData.userName}
        Date: ${bookingData.date}
        Time: ${bookingData.time}
        Duration: ${bookingData.duration} hours
        ${bookingData.paymentStatus ? `Payment Status: ${bookingData.paymentStatus}` : ''}
    `;

    // Email to client
    const mailOptionsToClient = {
        from: process.env.GMAIL_USER,
        to: userEmail,
        subject: subject,
        text: `Dear ${bookingData.userName},\n\nYour booking has been ${type}d.\n\nDetails:\n${bookingDetails}\n\nThank you.`
    };
    transporter.sendMail(mailOptionsToClient).catch(err => console.error(`Error sending client ${type} email:`, err));

    // Email to admin
    const confirmationLink = bookingId ? `${process.env.FRONTEND_URL}/confirm-payment?bookingId=${bookingId}` : 'N/A';
    const adminText = `A booking has been ${type}d.\n\nDetails:\n${bookingDetails}\n\n${bookingId ? `Confirm Payment Link: ${confirmationLink}` : ''}`;

    const mailOptionsToAdmin = {
        from: process.env.GMAIL_USER,
        to: ADMIN_EMAIL,
        subject: `Admin Notification: ${subject}`,
        text: adminText
    };
    transporter.sendMail(mailOptionsToAdmin).catch(err => console.error(`Error sending admin ${type} email:`, err));
};


// Middleware to authenticate requests
const authenticate = async (req, res, next) => {
  const idToken = req.headers.authorization?.split('Bearer ')[1];
  if (!idToken) {
    return res.status(401).send({ error: 'Unauthorized' });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    res.status(401).send({ error: 'Unauthorized' });
  }
};

app.post('/api/update-profile', authenticate, async (req, res) => {
  const { displayName, email } = req.body;
  const { uid } = req.user;

  if (!displayName || typeof displayName !== 'string' || displayName.trim() === '') {
    return res.status(400).send({ error: 'The "displayName" argument is required and must be a non-empty string.' });
  }

  try {
    await admin.auth().updateUser(uid, {
      displayName: displayName.trim(),
    });

    const userProfileDocRef = db.doc(`artifacts/${APP_ID_FOR_FIRESTORE_PATH}/users/${uid}/profiles/userProfile`);
    await userProfileDocRef.set({
      userId: uid,
      displayName: displayName.trim(),
      email: email, // Add this line to save the email
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    res.send({ success: true, message: 'User profile updated successfully!' });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).send({ error: 'Failed to update user profile due to a server error.' });
  }
});

app.post('/api/confirm-booking', authenticate, async (req, res) => {
    const { bookingData, userName, editingBookingId } = req.body;
    const { uid, email } = req.user;

    try {
        let bookingId = editingBookingId;
        if (editingBookingId) {
            const bookingRef = db.doc(`artifacts/${APP_ID_FOR_FIRESTORE_PATH}/users/${uid}/bookings/${editingBookingId}`);
            const doc = await bookingRef.get();
            const existingBookingData = doc.data();
            let googleEventId = existingBookingData.googleEventId;

            await bookingRef.update({ ...bookingData, userName, lastUpdated: admin.firestore.FieldValue.serverTimestamp() });

            const enrichedBookingData = { ...bookingData, userName };

            if (googleEventId) {
                await updateCalendarEvent(googleEventId, enrichedBookingData, email);
            } else {
                // If googleEventId is missing (e.g., for old bookings), create a new event
                googleEventId = await createCalendarEvent(editingBookingId, enrichedBookingData, email);
                await bookingRef.update({ googleEventId });
            }
        } else {
            const bookingRef = await db.collection(`artifacts/${APP_ID_FOR_FIRESTORE_PATH}/users/${uid}/bookings`).add({
                ...bookingData,
                userName,
                userId: uid,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
            bookingId = bookingRef.id;
            const googleEventId = await createCalendarEvent(bookingId, { ...bookingData, userName }, email);
            await bookingRef.update({ googleEventId });
        }

        // Send confirmation email to client and admin
        await sendBookingEmails(editingBookingId ? 'update' : 'create', { ...bookingData, userName }, email, bookingId);

        res.send({ success: true, bookingId });
    } catch (error) {
        console.error('Error in /api/confirm-booking:', error);
        res.status(500).send({ error: 'Failed to confirm booking.', details: error.message });
    }
});

app.post('/api/cancel-booking', authenticate, adminOnly, async (req, res) => {
    const { bookingId } = req.body;
    const { uid } = req.user;

    try {
        const bookingRef = db.doc(`artifacts/${APP_ID_FOR_FIRESTORE_PATH}/users/${uid}/bookings/${bookingId}`);
        const doc = await bookingRef.get();
        const existingBookingData = doc.data();
        const googleEventId = existingBookingData.googleEventId;
        await bookingRef.delete();
        await deleteCalendarEvent(googleEventId);
        await sendBookingEmails('cancel', existingBookingData, req.user.email, bookingId);
        res.send({ success: true, message: 'Booking cancelled successfully.' });
    } catch (error) {
        console.error('Error cancelling booking:', error);
        res.status(500).send({ error: 'Failed to cancel booking.' });
    }
});

app.get('/api/check-booked-slots', authenticate, async (req, res) => {
    const { date } = req.query;
    if (!date) {
        return res.status(400).send({ error: 'Date parameter is required.' });
    }

    try {
        const bookingsSnapshot = await db.collectionGroup('bookings').get();
        const bookedSlots = bookingsSnapshot.docs.map(doc => doc.data());
        res.send({ bookedSlots });
    } catch (error) {
        console.error('Error fetching booked slots:', error);
        res.status(500).send({ error: 'Failed to fetch booked slots.', details: error.message });
    }
});

app.post('/api/confirm-payment', authenticate, async (req, res) => {
    const { bookingId } = req.body;
    const { uid } = req.user;

    try {
        const bookingRef = db.doc(`artifacts/${APP_ID_FOR_FIRESTORE_PATH}/users/${uid}/bookings/${bookingId}`);
        await bookingRef.update({ paymentStatus: 'paid' });
        res.send({ success: true, message: 'Payment confirmed successfully!' });
    } catch (error) {
        console.error('Error confirming payment:', error);
        res.status(500).send({ error: 'Failed to confirm payment.' });
    }
});

// Admin routes
app.get('/api/admin/bookings', authenticate, adminOnly, async (req, res) => {
    // Add admin role check here in the future
    try {
        const bookingsSnapshot = await db.collectionGroup('bookings').orderBy('date', 'desc').get();
        const bookings = bookingsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.send(bookings);
    } catch (error) {
        console.error('Error fetching all bookings:', error);
        res.status(500).send({ error: 'Failed to fetch all bookings.' });
    }
});

// GET /api/admin/users - Fetches all user profiles for the admin dropdown
app.get('/api/admin/users', authenticate, adminOnly, async (req, res) => {
  try {
    // Assumes you have admin-checking middleware that has already verified the user
    console.log('Request received for /api/admin/users');

    const profilesRef = db.collectionGroup('profiles');
    const snapshot = await profilesRef.get();

    if (snapshot.empty) {
      return res.status(200).json([]);
    }

    const usersList = [];
    snapshot.forEach(doc => {
      // The user's ID is the ID of the parent document of the 'profiles' subcollection
      const userId = doc.ref.parent.parent.id;
      usersList.push({
        id: userId,
        ...doc.data()
      });
    });

    res.status(200).json(usersList);

  } catch (error) {
    console.error('Error fetching all user profiles:', error);
    res.status(500).json({ message: 'Failed to fetch user profiles.' });
  }
});

app.post('/api/admin/bookings', authenticate, adminOnly, async (req, res) => {
    // Add admin role check here in the future
    const { bookingData, userName, userEmail } = req.body;"""

    try {
        console.log('Attempting to get user by email:', userEmail);
        const userRecord = await admin.auth().getUserByEmail(userEmail);""

    try {
        const userRecord = await admin.auth().getUserByEmail(userEmail);
        const uid = userRecord.uid;

        const bookingRef = await db.collection(`artifacts/${APP_ID_FOR_FIRESTORE_PATH}/users/${uid}/bookings`).add({
            ...bookingData,
            userName,
            userId: uid,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        const bookingId = bookingRef.id;
        await createCalendarEvent(bookingId, { ...bookingData, userName }, userEmail);
        await sendBookingEmails('create', { ...bookingData, userName }, userEmail, bookingId);
        res.send({ success: true, bookingId });
    } catch (error) {
        console.error('Error creating booking for user:', error);
        res.status(500).send({ error: 'Failed to create booking for user.' });
    }
});


// New endpoint for admin to create a user
app.post('/api/admin/create-user', authenticate, adminOnly, async (req, res) => {
    try {
        if (!req.user.isAdmin) {
            return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
        }

        const { email, password, displayName } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required.' });
        }

        const userRecord = await admin.auth().createUser({
            email: email,
            password: password,
            displayName: displayName,
        });

        // Optionally, you can also send a welcome email or set custom claims here
        // For example, sending login details via email (similar to /api/admin/send-login-details)
        const mailOptions = {
            from: process.env.GMAIL_USER,
            to: email,
            subject: 'Your Account Details',
            html: `<p>Hello ${displayName || email},</p>\n                   <p>Your account has been created. You can log in with the following details:</p>\n                   <p>Email: <strong>${email}</strong></p>\n                   <p>Password: <strong>${password}</strong></p>\n                   <p>Please change your password after logging in for security reasons.</p>`,
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Error sending login details email:', error);
            } else {
                console.log('Login details email sent:', info.response);
            }
        });

        res.status(201).json({ uid: userRecord.uid, email: userRecord.email, displayName: userRecord.displayName });
    } catch (error) {
        console.error('Error creating new user by admin:', error);
        if (error.code === 'auth/email-already-exists') {
            return res.status(409).json({ message: 'The email address is already in use by another account.' });
        }
        res.status(500).json({ message: 'Failed to create user', error: error.message });
    }
});


app.post('/api/admin/send-login-details', authenticate, adminOnly, async (req, res) => {
    const { userEmail, password } = req.body;

    if (!userEmail || !password) {
        return res.status(400).send({ error: 'User email and password are required.' });
    }

    try {
        const mailOptions = {
            from: process.env.GMAIL_USER,
            to: userEmail,
            subject: 'Your Login Details',
            html: `
                <p>Dear User,</p>
                <p>Your account has been created. You can now log in with the following details:</p>
                <p><strong>Email:</strong> ${userEmail}</p>
                <p><strong>Password:</strong> ${password}</p>
                <p>Please change your password after your first login.</p>
                <p>Thank you,</p>
                <p>The Booking Team</p>
            `
        };
        await transporter.sendMail(mailOptions);
        res.send({ success: true, message: 'Login details sent successfully.' });
    } catch (error) {
        console.error('Error sending login details email:', error);
        res.status(500).send({ error: 'Failed to send login details email.' });
    }
});

app.post('/api/admin/decline-booking', authenticate, adminOnly, async (req, res) => {
    const { bookingId, userId, calendarEventId, reason } = req.body;

    if (!bookingId || !userId || !reason) {
        return res.status(400).send({ error: 'Booking ID, User ID, and reason are required.' });
    }

    try {
        const bookingRef = db.doc(`artifacts/${APP_ID_FOR_FIRESTORE_PATH}/users/${userId}/bookings/${bookingId}`);
        await bookingRef.update({ status: 'declined' });

        if (calendarEventId) {
            await deleteCalendarEvent(calendarEventId);
        }

        const userRecord = await admin.auth().getUser(userId);
        const userEmail = userRecord.email;

        const mailOptions = {
            from: process.env.GMAIL_USER,
            to: userEmail,
            subject: 'Your Booking Has Been Declined',
            html: `
                <p>Dear User,</p>
                <p>We regret to inform you that your booking with ID ${bookingId} has been declined for the following reason:</p>
                <p><em>${reason}</em></p>
                <p>If you have any questions, please contact us.</p>
                <p>Thank you,</p>
                <p>The Booking Team</p>
            `
        };
        await transporter.sendMail(mailOptions);

        res.send({ success: true, message: 'Booking declined successfully.' });
    } catch (error) {
        console.error('Error declining booking:', error);
        res.status(500).send({ error: 'Failed to decline booking.' });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
