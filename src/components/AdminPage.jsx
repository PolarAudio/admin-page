import { useState, useMemo, useEffect, useCallback } from 'react';
import { formatIDR, formatDate, formatTime } from '../utils';
import { auth, db } from '../firebase/init';
import { collectionGroup, query, getDocs, onSnapshot } from 'firebase/firestore';
import { DJ_EQUIPMENT } from '../constants';

const HOURLY_RATE = 200000;

import EquipmentItem from '../components/EquipmentItem';
import BookingDetailsModal from './BookingDetailsModal'; // New Import

// CreateBookingForm Component
const CreateBookingForm = ({ onCreate, onCancel, currentUser, users, isSubmitting }) => {
    const [formData, setFormData] = useState({
        userName: '',
        userId: '',
        date: '',
        time: '',
        duration: 2,
        total: 2 * HOURLY_RATE,
        paymentStatus: 'pending',
        selectedEquipment: [], // New state for selected equipment
    });
    const [isExistingUser, setIsExistingUser] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState('');
    const [newUserEmail, setNewUserEmail] = useState('');
    const [creationError, setCreationError] = useState(null);
	const players = useMemo(() => DJ_EQUIPMENT.filter(eq => eq.category === 'player'), []);
    const mixers = useMemo(() => DJ_EQUIPMENT.filter(eq => eq.category === 'mixer'), []);
	const extra = useMemo(() => DJ_EQUIPMENT.filter(eq => eq.category === 'extra'), []);
	const [selectedEquipment, setSelectedEquipment] = useState([]);

    useEffect(() => {
        setFormData(prev => ({
            ...prev,
            total: parseInt(prev.duration || 0, 10) * HOURLY_RATE
        }));
    }, [formData.duration]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => {
            let newFormData = { ...prev, [name]: value };
            if (name === 'duration') {
                newFormData.total = parseInt(value || 0, 10) * HOURLY_RATE;
            }
            return newFormData;
        });
    };

    const handleUserSelectionChange = (e) => {
        const userId = e.target.value;
        setSelectedUserId(userId);
        const selectedUser = users.find(u => u.id === userId);
        if (selectedUser) {
            setFormData(prev => ({ ...prev, userName: selectedUser.displayName, userId: selectedUser.id }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setCreationError(null);

        let bookingPayload = {};

        if (isExistingUser) {
            if (!selectedUserId) {
                setCreationError("Please select an existing user.");
                return;
            }
            const selectedUser = users.find(u => u.id === selectedUserId);

            if (!selectedUser || !selectedUser.email) {
                setCreationError("The selected user is missing an email address in their profile. Please update their profile data in Firestore.");
                return;
            }

            bookingPayload = {
                bookingData: {
                    date: formData.date,
                    time: formData.time,
                    duration: formData.duration,
                    total: formData.total,
                    paymentStatus: formData.paymentStatus,
                    equipment: selectedEquipment.map(eq => ({ id: eq.id, name: eq.name, type: eq.type, category: eq.category })),
                },
                userId: selectedUser.id,
                userName: selectedUser.displayName,
                userEmail: selectedUser.email, // Ensure email is included
            };
        } else {
            if (!newUserEmail) {
                setCreationError("Email is required for new user creation.");
                return;
            }
            try {
                const idToken = await currentUser.getIdToken();
                const createUserResponse = await fetch(`${import.meta.env.VITE_BACKEND_API_URL}/api/admin/create-user`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${idToken}`,
                    },
                    body: JSON.stringify({ email: newUserEmail, displayName: formData.userName || newUserEmail }),
                });

                if (!createUserResponse.ok) {
                    const errorData = await createUserResponse.json();
                    throw new Error(errorData.message || 'Failed to create new user');
                }

                const { uid: finalUserId, email: finalUserEmail, displayName: finalUserName } = await createUserResponse.json();

                bookingPayload = {
                    bookingData: {
                        date: formData.date,
                        time: formData.time,
                        duration: formData.duration,
                        total: formData.total,
                        paymentStatus: formData.paymentStatus,
                        equipment: selectedEquipment.map(eq => ({ id: eq.id, name: eq.name, type: eq.type, category: eq.category })),
                    },
                    userId: finalUserId,
                    userName: finalUserName,
                    userEmail: finalUserEmail, // Ensure email is included
                };

            } catch (err) {
                setCreationError(`Failed to create new user: ${err.message}`);
                return;
            }
        }

        console.log("Sending booking payload with userEmail:", bookingPayload.userEmail);
        onCreate(bookingPayload);
    };
	const toggleEquipment = useCallback((equipment) => {
        setSelectedEquipment(prev => prev.some(item => item.id === equipment.id)
            ? prev.filter(item => item.id !== equipment.id)
            : [...prev, equipment]
        );
    }, []);

    return (
        <form onSubmit={handleSubmit} className="bg-gray-700 p-6 rounded-xl shadow-inner space-y-4">
            <h2 className="text-2xl font-bold text-orange-300 mb-4">Create New Booking</h2>
            {creationError && <p className="text-red-500 text-center mb-4">{creationError}</p>}

            {/* User Type Toggle */}
            <div className="flex justify-center space-x-4 mb-4">
                <label className="flex items-center">
                    <input type="radio" name="userType" checked={!isExistingUser} onChange={() => setIsExistingUser(false)} className="form-radio h-4 w-4 text-orange-600"/>
                    <span className="ml-2 text-gray-300">New User</span>
                </label>
                <label className="flex items-center">
                    <input type="radio" name="userType" checked={isExistingUser} onChange={() => setIsExistingUser(true)} className="form-radio h-4 w-4 text-orange-600"/>
                    <span className="ml-2 text-gray-300">Existing User</span>
                </label>
            </div>

            {isExistingUser ? (
                <div>
                    <label htmlFor="existing-user" className="block text-sm font-medium text-gray-300 mb-1">Select User</label>
                    <select id="existing-user" value={selectedUserId} onChange={handleUserSelectionChange} required className="w-full p-3 border border-gray-600 rounded-xl bg-gray-900 text-white focus:ring focus:ring-orange-500">
                        <option value="" disabled>-- Select a user --</option>
                        {users.map(user => (
                            <option key={user.id} value={user.id}>{user.displayName || user.email} ({user.id})</option>
                        ))}
                    </select>
                </div>
            ) : (
                <>
                    <div>
                        <label htmlFor="create-userName" className="block text-sm font-medium text-gray-300 mb-1">User Name</label>
                        <input type="text" id="create-userName" name="userName" placeholder="User Name" value={formData.userName} onChange={handleChange} required className="w-full p-3 border border-gray-600 rounded-xl bg-gray-900 text-white focus:ring focus:ring-orange-500" />
                    </div>
                    <div>
                        <label htmlFor="new-user-email" className="block text-sm font-medium text-gray-300 mb-1">New User Email</label>
                        <input type="email" id="new-user-email" name="newUserEmail" placeholder="user@example.com" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} required className="w-full p-3 border border-gray-600 rounded-xl bg-gray-900 text-white focus:ring focus:ring-orange-500" />
                    </div>
                </>
            )}

            <div>
                <label htmlFor="create-date" className="block text-sm font-medium text-gray-300 mb-1">Date</label>
                <input type="date" id="create-date" name="date" value={formData.date} onChange={handleChange} required className="w-full p-3 border border-gray-600 rounded-xl bg-gray-900 text-white focus:ring focus:ring-orange-500" />
            </div>
            <div>
                <label htmlFor="create-time" className="block text-sm font-medium text-gray-300 mb-1">Time</label>
                <input type="time" id="create-time" name="time" value={formData.time} onChange={handleChange} required className="w-full p-3 border border-gray-600 rounded-xl bg-gray-900 text-white focus:ring focus:ring-orange-500" />
            </div>
            <div>
                <label htmlFor="create-duration" className="block text-sm font-medium text-gray-300 mb-1">Duration (hours)</label>
                <input type="number" id="create-duration" name="duration" value={formData.duration} onChange={handleChange} required className="w-full p-3 border border-gray-600 rounded-xl bg-gray-900 text-white focus:ring focus:ring-orange-500" />
            </div>
            <div>
                <label htmlFor="create-total" className="block text-sm font-medium text-gray-300 mb-1">Total (IDR)</label>
                <input type="number" id="create-total" name="total" value={formData.total} readOnly className="w-full p-3 border border-gray-600 rounded-xl bg-gray-800 text-white focus:ring focus:ring-orange-500" />
            </div>
            <div>
                <label htmlFor="create-paymentStatus" className="block text-sm font-medium text-gray-300 mb-1">Payment Status</label>
                <select id="create-paymentStatus" name="paymentStatus" value={formData.paymentStatus} onChange={handleChange} className="w-full p-3 border border-gray-600 rounded-xl bg-gray-900 text-white focus:ring focus:ring-orange-500">
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                </select>
            </div>
            <div className="bg-gray-800 shadow-2xl rounded-2xl p-8 mb-6 border border-gray-700">
                <h2 className="text-2xl font-semibold text-orange-300 mb-6">🎛️ Select Equipment</h2>
                <div className="space-y-3 mb-6"> {/* Removed grid, just stacked */}
                    <h3 className="text-lg font-semibold text-gray-300 mb-2">Players</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4"> {/* Optional: add grid here if you want players/mixers side-by-side */}
						{players.map(eq => <EquipmentItem key={eq.id} equipment={eq} isSelected={selectedEquipment.some(i => i.id === eq.id)} onToggle={toggleEquipment} />)}
                    </div>

                    <h3 className="text-lg font-semibold text-gray-300 mb-2 mt-4">Mixers</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4"> {/* Optional: add grid here */}
						{mixers.map(eq => <EquipmentItem key={eq.id} equipment={eq} isSelected={selectedEquipment.some(i => i.id === eq.id)} onToggle={toggleEquipment} />)}
                    </div>

					<h3 className="text-lg font-semibold text-gray-300 mb-2 mt-4">Extra</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4"> {/* Optional: add grid here */}
						{extra.map(eq => <EquipmentItem key={eq.id} equipment={eq} isSelected={selectedEquipment.some(i => i.id === eq.id)} onToggle={toggleEquipment} />)}
                    </div>
                </div>
            </div>
            <div className="flex justify-end space-x-4 mt-6">
                <button type="submit" className="px-6 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition shadow-lg" disabled={isSubmitting}>{isSubmitting ? 'Creating...' : 'Create Booking'}</button>
                <button type="button" onClick={onCancel} className="px-6 py-3 bg-gray-600 text-white rounded-xl font-semibold hover:bg-gray-700 transition shadow-lg" disabled={isSubmitting}>Cancel</button>
            </div>
        </form>
    );
};

// EditBookingForm Component
const EditBookingForm = ({ booking, onUpdate, onCancel, isSubmitting }) => {
    const [formData, setFormData] = useState({
        ...booking,
        selectedEquipment: booking.equipment ? booking.equipment.map(eq => eq.id) : [],
        userEmail: booking.userEmail || '', // Initialize userEmail
    });

    useEffect(() => {
        setFormData(prev => ({
            ...prev,
            total: parseInt(prev.duration || 0, 10) * HOURLY_RATE
        }));
    }, [formData.duration]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => {
            let newFormData = { ...prev, [name]: value };
            if (name === 'duration') {
                newFormData.total = parseInt(value || 0, 10) * HOURLY_RATE;
            }
            return newFormData;
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const updatedData = {
            ...formData,
            equipment: formData.selectedEquipment.map(id => {
                const equipment = DJ_EQUIPMENT.find(eq => eq.id === id);
                return { id: equipment.id, name: equipment.name, type: equipment.type, category: equipment.category };
            }),
        };
        onUpdate(formData.id, updatedData);
    };

    return (
        <form onSubmit={handleSubmit} className="bg-gray-700 p-6 rounded-xl shadow-inner space-y-4">
            <h2 className="text-2xl font-bold text-orange-300 mb-4">Edit Booking</h2>
            <div>
                <label htmlFor="edit-userName" className="block text-sm font-medium text-gray-300 mb-1">User Name</label>
                <input type="text" id="edit-userName" name="userName" value={formData.userName} onChange={handleChange} required className="w-full p-3 border border-gray-600 rounded-xl bg-gray-900 text-white focus:ring focus:ring-orange-500" />
            </div>
            <div>
                <label htmlFor="edit-userId" className="block text-sm font-medium text-gray-300 mb-1">User ID</label>
                <input type="text" id="edit-userId" name="userId" value={formData.userId} onChange={handleChange} required className="w-full p-3 border border-gray-600 rounded-xl bg-gray-900 text-white focus:ring focus:ring-orange-500" />
            </div>
            <div>
                <label htmlFor="edit-userEmail" className="block text-sm font-medium text-gray-300 mb-1">User Email</label>
                <input type="email" id="edit-userEmail" name="userEmail" value={formData.userEmail} onChange={handleChange} required className="w-full p-3 border border-gray-600 rounded-xl bg-gray-900 text-white focus:ring focus:ring-orange-500" />
            </div>
            <div>
                <label htmlFor="edit-date" className="block text-sm font-medium text-gray-300 mb-1">Date</label>
                <input type="date" id="edit-date" name="date" value={formData.date} onChange={handleChange} required className="w-full p-3 border border-gray-600 rounded-xl bg-gray-900 text-white focus:ring focus:ring-orange-500" />
            </div>
            <div>
                <label htmlFor="edit-time" className="block text-sm font-medium text-gray-300 mb-1">Time</label>
                <input type="time" id="edit-time" name="time" value={formData.time} onChange={handleChange} required className="w-full p-3 border border-gray-600 rounded-xl bg-gray-900 text-white focus:ring focus:ring-orange-500" />
            </div>
            <div>
                <label htmlFor="edit-duration" className="block text-sm font-medium text-gray-300 mb-1">Duration (hours)</label>
                <input
                    type="number"
                    id="edit-duration"
                    name="duration"
                    value={formData.duration}
                    onChange={handleChange} required
                    className="w-full p-3 border border-gray-600 rounded-xl bg-gray-900 text-white focus:ring focus:ring-orange-500"
                />
            </div>
            <div>
                <label htmlFor="edit-total" className="block text-sm font-medium text-gray-300 mb-1">Total (IDR)</label>
                <input
                    type="number"
                    id="edit-total"
                    name="total"
                    value={formData.total}
                    onChange={handleChange}
                    className="w-full p-3 border border-gray-600 rounded-xl bg-gray-900 text-white focus:ring focus:ring-orange-500"
                />
            </div>
            <div>
                <label htmlFor="edit-paymentStatus" className="block text-sm font-medium text-gray-300 mb-1">Payment Status</label>
                <select id="edit-paymentStatus" name="paymentStatus" value={formData.paymentStatus} onChange={handleChange} className="w-full p-3 border border-gray-600 rounded-xl bg-gray-900 text-white focus:ring focus:ring-orange-500">
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Equipment</label>
                <div className="grid grid-cols-2 gap-2">
                    {DJ_EQUIPMENT.map((equipment) => (
                        <label key={equipment.id} className="flex items-center text-gray-300">
                            <input
                                type="checkbox"
                                value={equipment.id}
                                checked={formData.selectedEquipment.includes(equipment.id)}
                                onChange={(e) => {
                                    const { value, checked } = e.target;
                                    setFormData(prev => {
                                        const newSelectedEquipment = checked
                                            ? [...prev.selectedEquipment, parseInt(value)]
                                            : prev.selectedEquipment.filter(id => id !== parseInt(value));
                                        return { ...prev, selectedEquipment: newSelectedEquipment };
                                    });
                                }}
                                className="form-checkbox h-4 w-4 text-orange-600"
                            />
                            <span className="ml-2">{equipment.name}</span>
                        </label>
                    ))}
                </div>
            </div>
            <div className="flex justify-end space-x-4 mt-6">
                <button type="submit" className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition shadow-lg" disabled={isSubmitting}>{isSubmitting ? 'Updating...' : 'Update Booking'}</button>
                <button type="button" onClick={onCancel} className="px-6 py-3 bg-gray-600 text-white rounded-xl font-semibold hover:bg-gray-700 transition shadow-lg" disabled={isSubmitting}>Cancel</button>
            </div>
        </form>
    );
};

// AdminPage Component
const AdminPage = ({ app, isAdmin, currentUser }) => {
    const appIdFromCanvas = app?.id || 'booking-app-1af02';
    console.log("AdminPage: Using appIdFromCanvas:", appIdFromCanvas);
    
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [editingBooking, setEditingBooking] = useState(null);
    const [isCreating, setIsCreating] = useState(false);
    const [isCreateFormSubmitting, setIsCreateFormSubmitting] = useState(false);
    const [isEditFormSubmitting, setIsEditFormSubmitting] = useState(false);
    const [users, setUsers] = useState([]); // New state for users
    const [showDetailsModal, setShowDetailsModal] = useState(false); // New state
    const [selectedBookingForDetails, setSelectedBookingForDetails] = useState(null); // New state
    const [creditsError, setCreditsError] = useState(null);
    const [creditsSuccess, setCreditsSuccess] = useState(null);
    const [selectedUserIdForCredits, setSelectedUserIdForCredits] = useState('');
    const [creditsAmount, setCreditsAmount] = useState(1);
    const [isAddingCredits, setIsAddingCredits] = useState(false);
    const [maintenanceMode, setMaintenanceMode] = useState(false);
    const [maintenanceMessage, setMaintenanceMessage] = useState('');
    const [maintenanceLoading, setMaintenanceLoading] = useState(false);
    const [maintenanceError, setMaintenanceError] = useState(null);
    const [maintenanceSuccess, setMaintenanceSuccess] = useState(null);

    const handleShowDetails = useCallback((booking) => {
        setSelectedBookingForDetails(booking);
        setShowDetailsModal(true);
    }, []);

    const handleCloseDetails = useCallback(() => {
        setShowDetailsModal(false);
        setSelectedBookingForDetails(null);
    }, []);

    const fetchUsers = useCallback(async () => {
        if (!currentUser) {
            setError("Authentication error. Cannot load user list.");
            return;
        }
        try {
            const idToken = await currentUser.getIdToken();
            const response = await fetch(`${import.meta.env.VITE_BACKEND_API_URL}/api/admin/users`, {
                headers: {
                    'Authorization': `Bearer ${idToken}`,
                },
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to fetch users');
            }
            
            const usersData = await response.json();
            setUsers(usersData);
        } catch (err) {
            console.error("Error fetching users:", err);
            setError(`Could not load user list: ${err.message}`);
        }
    }, [currentUser]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const fetchBookings = useCallback(() => {
        if (!isAdmin || !currentUser) {
            setLoading(false);
            setBookings([]);
            return () => {}; // Return an empty unsubscribe function
        }
        setLoading(true);
        setError(null);

        const bookingsQuery = query(collectionGroup(db, 'bookings'));

        const unsubscribe = onSnapshot(bookingsQuery, (snapshot) => {
            const fetchedBookings = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Enrich bookings with userEmail
            const bookingsWithEmail = fetchedBookings.map(booking => {
                const user = users.find(u => u.id === booking.userId);
                return { ...booking, userEmail: user ? user.email : 'N/A' };
            });

            setBookings(bookingsWithEmail);
            setLoading(false);
        }, (err) => {
            console.error("AdminPage: Error fetching real-time bookings:", err);
            setError(err.message);
            setLoading(false);
        });

        return unsubscribe; // Return the unsubscribe function
    }, [isAdmin, currentUser, users]); // Depend on users as well

    useEffect(() => {
        console.log("AdminPage useEffect: Setting up real-time bookings listener.");
        const unsubscribe = fetchBookings();
        return () => {
            console.log("AdminPage useEffect: Cleaning up real-time bookings listener.");
            unsubscribe();
        };
    }, [fetchBookings]);

    const handleCreateBooking = useCallback(async (newBookingData) => {
        console.log("handleCreateBooking: Attempting to create booking with data:", newBookingData);
        setIsCreateFormSubmitting(true);
        try {
            const idToken = await currentUser.getIdToken();
            console.log("Sending new booking data to backend:", newBookingData);
            const response = await fetch(`${import.meta.env.VITE_BACKEND_API_URL}/api/admin/bookings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`,
                },
                body: JSON.stringify(newBookingData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to create booking');
            }

            const result = await response.json();
            console.log("handleCreateBooking: Booking created successfully:", result);
            setIsCreating(false);
            setError(null);
            fetchBookings();
        } catch (err) {
            console.error("handleCreateBooking: Error creating booking:", err);
            setError(`Failed to create booking: ${err.message}`);
        } finally {
            setIsCreateFormSubmitting(false);
        }
    }, [currentUser, fetchBookings]);

    const handleUpdateBooking = useCallback(async (id, updatedData) => {
        console.log("handleUpdateBooking: Attempting to update booking ID:", id, "with data:", updatedData);
        setIsEditFormSubmitting(true);
        try {
            const idToken = await currentUser.getIdToken();
            const response = await fetch(`${import.meta.env.VITE_BACKEND_API_URL}/api/admin/confirm-booking`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`,
                },
                body: JSON.stringify({
                    bookingData: {
                        date: updatedData.date,
                        time: updatedData.time,
                        duration: updatedData.duration,
                        total: updatedData.total,
                        paymentStatus: updatedData.paymentStatus,
                        equipment: updatedData.equipment.map(eq => ({ id: eq.id, name: eq.name, type: eq.type, category: eq.category })),
                    },
                    editingBookingId: id,
                    userId: updatedData.userId,
                    userName: updatedData.userName,
                    userEmail: updatedData.userEmail, // Ensure userEmail is included
                    calendarEventId: updatedData.calendarEventId, // Ensure calendarEventId is included
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to update booking');
            }

            const result = await response.json();
            console.log("handleUpdateBooking: Booking updated successfully:", result);
            setEditingBooking(null);
            setError(null);
            fetchBookings();
        } catch (err) {
            console.error("handleUpdateBooking: Error updating booking:", err);
            setError(`Failed to update booking: ${err.message}`);
        } finally {
            setIsEditFormSubmitting(false);
        }
    }, [currentUser, fetchBookings]);

    const handleDeleteBooking = useCallback(async (booking) => {
        console.log("handleDeleteBooking: Attempting to delete booking:", booking);
        try {
            const idToken = await currentUser.getIdToken();
            const response = await fetch(`${import.meta.env.VITE_BACKEND_API_URL}/api/admin/cancel-booking`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`,
                },
                body: JSON.stringify({ bookingId: booking.id, userId: booking.userId, calendarEventId: booking.calendarEventId }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to delete booking');
            }

            const result = await response.json();
            console.log("handleDeleteBooking: Booking deleted successfully:", result);
            setError(null);
            fetchBookings();
        } catch (err) {
            console.error("handleDeleteBooking: Error deleting booking:", err);
            setError(`Failed to delete booking: ${err.message}`);
        }
    }, [currentUser, fetchBookings]);

    const handleConfirmBooking = useCallback(async (booking) => {
        console.log("handleConfirmBooking: Attempting to confirm booking:", booking);
        try {
            const idToken = await currentUser.getIdToken();
            const response = await fetch(`${import.meta.env.VITE_BACKEND_API_URL}/api/admin/confirm-booking-status`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`,
                },
                body: JSON.stringify({ bookingId: booking.id, userId: booking.userId }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to confirm booking');
            }

            const result = await response.json();
            console.log("handleConfirmBooking: Booking confirmed successfully:", result);
            setError(null);
            fetchBookings();
        } catch (err) {
            console.error("handleConfirmBooking: Error confirming booking:", err);
            setError(`Failed to confirm booking: ${err.message}`);
        }
    }, [currentUser, fetchBookings]);

    useEffect(() => {
        const fetchMaintenanceStatus = async () => {
            try {
                const response = await fetch(`${import.meta.env.VITE_BACKEND_API_URL}/api/maintenance-status`);
                if (!response.ok) {
                    throw new Error('Failed to fetch maintenance status');
                }
                const data = await response.json();
                setMaintenanceMode(data.isEnabled);
                setMaintenanceMessage(data.message);
            } catch (err) {
                setMaintenanceError(err.message);
            }
        };
        fetchMaintenanceStatus();
    }, []);

    const handleUpdateMaintenanceMode = useCallback(async () => {
        setMaintenanceLoading(true);
        setMaintenanceError(null);
        setMaintenanceSuccess(null);
        try {
            const idToken = await currentUser.getIdToken();
            const response = await fetch(`${import.meta.env.VITE_BACKEND_API_URL}/api/admin/maintenance-mode`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`,
                },
                body: JSON.stringify({ isEnabled: maintenanceMode, message: maintenanceMessage }),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to update maintenance mode.');
            }
            setMaintenanceSuccess(data.message);
        } catch (err) {
            setMaintenanceError(err.message);
        } finally {
            setMaintenanceLoading(false);
        }
    }, [currentUser, maintenanceMode, maintenanceMessage]);

    const handleAddCredits = useCallback(async () => {
        if (!selectedUserIdForCredits || !creditsAmount) {
            setCreditsError("Please select a user and enter an amount.");
            return;
        }
        setCreditsError(null);
        setCreditsSuccess(null);
        setIsAddingCredits(true);
        try {
            const idToken = await currentUser.getIdToken();
            const response = await fetch(`${import.meta.env.VITE_BACKEND_API_URL}/api/admin/add-credits`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`,
                },
                body: JSON.stringify({ userId: selectedUserIdForCredits, amount: parseInt(creditsAmount, 10) }),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to add credits.');
            }
            setCreditsSuccess(data.message);
            fetchUsers(); // Re-fetch users to update credits display
        } catch (err) {
            setCreditsError(err.message);
        } finally {
            setIsAddingCredits(false);
        }
    }, [currentUser, selectedUserIdForCredits, creditsAmount, fetchUsers]);

    if (loading) return <div className="text-center text-orange-200 text-xl mt-8">Loading Admin Dashboard...</div>;
    if (error) return <div className="text-center text-red-500 text-xl mt-8">Error: {error}</div>;

    return (
        <div className="min-h-screen bg-gray-900 text-white p-8">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-4xl font-bold text-orange-400 mb-8 text-center">Admin Dashboard</h1>

                <div className="bg-gray-800 shadow-2xl rounded-2xl p-6 mb-8 border border-gray-700">
                    {isCreating && (
                        <CreateBookingForm
                            onCreate={handleCreateBooking}
                            onCancel={() => setIsCreating(false)}
                            currentUser={currentUser}
                            users={users}
                            isSubmitting={isCreateFormSubmitting}
                        />
                    )}
                    {editingBooking && (
                        <EditBookingForm
                            booking={editingBooking}
                            onUpdate={handleUpdateBooking}
                            onCancel={() => setEditingBooking(null)}
                            isSubmitting={isEditFormSubmitting}
                        />
                    )}
                    {!isCreating && !editingBooking && isAdmin && (
                        <div className="flex flex-col space-y-4">
                            <button
                                onClick={() => setIsCreating(true)}
                                className="w-full py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition shadow-lg"
                            >
                                + Add New Booking
                            </button>
                        </div>
                    )}
                </div>

                <div className="bg-gray-800 shadow-2xl rounded-2xl p-6 mb-8 border border-gray-700">
                    <h2 className="text-2xl font-semibold text-orange-300 mb-6">Add Credits to User</h2>
                    {creditsError && <p className="text-red-500 text-center mb-4">{creditsError}</p>}
                    {creditsSuccess && <p className="text-green-500 text-center mb-4">{creditsSuccess}</p>}
                    <div className="flex flex-col space-y-4">
                        <select value={selectedUserIdForCredits} onChange={(e) => setSelectedUserIdForCredits(e.target.value)} className="w-full p-3 border border-gray-600 rounded-xl bg-gray-900 text-white focus:ring focus:ring-orange-500">
                            <option value="" disabled>-- Select a user --</option>
                            {users.map(user => (
                                <option key={user.id} value={user.id}>{user.displayName || user.email} ({user.id}) - Credits: {user.credits || 0}</option>
                            ))}
                        </select>
                        <input type="number" value={creditsAmount} onChange={(e) => setCreditsAmount(e.target.value)} placeholder="Amount" className="w-full p-3 border border-gray-600 rounded-xl bg-gray-900 text-white focus:ring focus:ring-orange-500" />
                        <button onClick={handleAddCredits} disabled={isAddingCredits} className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition shadow-lg disabled:bg-gray-600">
                            {isAddingCredits ? 'Adding...' : 'Add Credits'}
                        </button>
                    </div>
                </div>

                <div className="bg-gray-800 shadow-2xl rounded-2xl p-6 mb-8 border border-gray-700">
                    <h2 className="text-2xl font-semibold text-orange-300 mb-6">Maintenance Mode</h2>
                    {maintenanceError && <p className="text-red-500 text-center mb-4">{maintenanceError}</p>}
                    {maintenanceSuccess && <p className="text-green-500 text-center mb-4">{maintenanceSuccess}</p>}
                    <div className="flex flex-col space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-gray-300">Enable Maintenance Mode</span>
                            <label className="switch">
                                <input type="checkbox" checked={maintenanceMode} onChange={() => setMaintenanceMode(!maintenanceMode)} />
                                <span className="slider round"></span>
                            </label>
                        </div>
                        <textarea
                            value={maintenanceMessage}
                            onChange={(e) => setMaintenanceMessage(e.target.value)}
                            placeholder="Maintenance Message"
                            className="w-full p-3 border border-gray-600 rounded-xl bg-gray-900 text-white focus:ring focus:ring-orange-500"
                        />
                        <button onClick={handleUpdateMaintenanceMode} disabled={maintenanceLoading} className="w-full py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition shadow-lg disabled:bg-gray-600">
                            {maintenanceLoading ? 'Saving...' : 'Save Maintenance Settings'}
                        </button>
                    </div>
                </div>

                <div className="bg-gray-800 shadow-2xl rounded-2xl p-6 border border-gray-700">
                    <h2 className="text-2xl font-semibold text-orange-300 mb-6">All Bookings</h2>
                    {bookings.length === 0 ? (
                        <p className="text-gray-400 text-center">No bookings found.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-700">
                                <thead className="bg-gray-700">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">User</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Date</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Time</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Duration</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Total</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Payment</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Status</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-gray-800 divide-y divide-gray-700">
                                    {bookings.map((booking) => (
                                        <tr key={booking.id} onClick={() => handleShowDetails(booking)} className="cursor-pointer hover:bg-gray-700 transition-colors duration-200">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-100">{booking.userName || 'N/A'} ({booking.userId || 'N/A'})</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{formatDate(booking.date)}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{formatTime(booking.time)}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{booking.duration} hrs</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-400">{formatIDR(booking.total)}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${booking.paymentStatus === 'paid' ? 'bg-green-700 text-green-100' : 'bg-yellow-700 text-yellow-100'}`}>
                                                    {booking.paymentStatus}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${booking.status === 'booking confirmed' ? 'bg-green-700 text-green-100' : 'bg-yellow-700 text-yellow-100'}`}>
                                                    {booking.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                {isAdmin && (
                                                    <>
                                                        {booking.status === 'waiting for confirmation' && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleConfirmBooking(booking); }}
                                                                className="text-green-400 hover:text-green-600 mr-4"
                                                            >
                                                                Confirm
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setEditingBooking(booking); }}
                                                            className="text-indigo-400 hover:text-indigo-600 mr-4"
                                                        >
                                                            Edit
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDeleteBooking(booking); }}
                                                            className="text-red-400 hover:text-red-600"
                                                        >
                                                            Delete
                                                        </button>
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
            {/* Booking Details Modal */}
            <BookingDetailsModal
                show={showDetailsModal}
                onClose={handleCloseDetails}
                booking={selectedBookingForDetails}
            />
        </div>
    );
};

export default AdminPage;

