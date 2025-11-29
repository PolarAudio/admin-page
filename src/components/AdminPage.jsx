import { useState, useMemo, useEffect, useCallback } from 'react';
import { formatIDR, formatDate, formatTime } from '../utils';
import { auth, db } from '../firebase/init';
import { collectionGroup, query, getDocs, onSnapshot } from 'firebase/firestore';
import { DJ_EQUIPMENT } from '../constants';

const HOURLY_RATE = 200000;

import EquipmentItem from '../components/EquipmentItem';
import BookingDetailsModal from './BookingDetailsModal'; // New Import
import EditBookingModal from './EditBookingModal'; // New Import

// CreateBookingForm Component
const CreateBookingForm = ({ onCreate, onCancel, currentUser, users, isSubmitting, usersLoading, usersError }) => {
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
                    {usersLoading ? (
                        <p className="text-center text-orange-200 text-sm">Loading users...</p>
                    ) : usersError ? (
                        <p className="text-center text-red-500 text-sm">Error loading users: {usersError}</p>
                    ) : (
                        <select id="existing-user" value={selectedUserId} onChange={handleUserSelectionChange} required className="w-full p-3 border border-gray-600 rounded-xl bg-gray-900 text-white focus:ring focus:ring-orange-500">
                            <option value="" disabled>-- Select a user --</option>
                            {users.map(user => (
                                <option key={user.id} value={user.id}>{user.displayName || user.email} ({user.email})</option>
                            ))}
                        </select>
                    )}
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



// AdminPage Component
const AdminPage = ({ app, isAdmin, currentUser }) => {
    const appIdFromCanvas = app?.id || 'booking-app-1af02';
    console.log("AdminPage: Using appIdFromCanvas:", appIdFromCanvas);
    
    const [bookings, setBookings] = useState([]);
    const [pendingBookings, setPendingBookings] = useState([]);
    const [finishedBookings, setFinishedBookings] = useState([]);
    const [openBookingsError, setOpenBookingsError] = useState(null);
    const [finishedBookingsError, setFinishedBookingsError] = useState(null);
    const [usersError, setUsersError] = useState(null);
    const [openBookingsLoading, setOpenBookingsLoading] = useState(true);
    const [finishedBookingsLoading, setFinishedBookingsLoading] = useState(true);
    const [usersLoading, setUsersLoading] = useState(true);
    const [editingBooking, setEditingBooking] = useState(null);
    const [isCreating, setIsCreating] = useState(false);
    const [isCreateFormSubmitting, setIsCreateFormSubmitting] = useState(false);
    const [isEditFormSubmitting, setIsEditFormSubmitting] = useState(false);
    const [users, setUsers] = useState([]); // New state for users
    const [showDetailsModal, setShowDetailsModal] = useState(false); // New state
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
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
            setUsersError("Authentication error. Cannot load user list.");
            return;
        }
        setUsersLoading(true);
        setUsersError(null);
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
            setUsersError(`Could not load user list: ${err.message}`);
        } finally {
            setUsersLoading(false);
        }
    }, [currentUser]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const fetchBookings = useCallback(async () => {
        if (!isAdmin || !currentUser) {
            setOpenBookings([]);
            setFinishedBookings([]);
            setOpenBookingsLoading(false);
            setFinishedBookingsLoading(false);
            return;
        }

        const idToken = await currentUser.getIdToken();

        let currentEnrichedOpenBookings = [];
        let currentEnrichedFinishedBookings = [];

        // Fetch open bookings
        setOpenBookingsLoading(true);
        setOpenBookingsError(null);
        try {
            const openBookingsResponse = await fetch(`${import.meta.env.VITE_BACKEND_API_URL}/api/admin/bookings`, {
                headers: { 'Authorization': `Bearer ${idToken}` },
            });
            if (!openBookingsResponse.ok) {
                const errorData = await openBookingsResponse.json();
                throw new Error(errorData.message || 'Failed to fetch open bookings');
            }
            const openBookingsData = await openBookingsResponse.json();
            currentEnrichedOpenBookings = openBookingsData.map(booking => {
                const user = users.find(u => u.id === booking.userId);
                return { ...booking, userEmail: user ? user.email : 'N/A' };
            });
            setOpenBookings(currentEnrichedOpenBookings);
            setPendingBookings(currentEnrichedOpenBookings.filter(b => b.status === 'waiting for confirmation'));
        } catch (err) {
            console.error("AdminPage: Error fetching open bookings:", err);
            setOpenBookingsError(`Failed to fetch open bookings: ${err.message}`);
            setOpenBookings([]); // Clear open bookings on error
            setPendingBookings([]); // Clear pending bookings on error
        } finally {
            setOpenBookingsLoading(false);
        }

        // Fetch finished bookings
        setFinishedBookingsLoading(true);
        setFinishedBookingsError(null);
        try {
            const finishedBookingsResponse = await fetch(`${import.meta.env.VITE_BACKEND_API_URL}/api/admin/bookings/finished`, {
                headers: { 'Authorization': `Bearer ${idToken}` },
            });
            if (!finishedBookingsResponse.ok) {
                const errorData = await finishedBookingsResponse.json();
                throw new Error(errorData.message || 'Failed to fetch finished bookings');
            }
            const finishedBookingsData = await finishedBookingsResponse.json();
            currentEnrichedFinishedBookings = finishedBookingsData.map(booking => {
                const user = users.find(u => u.id === booking.userId);
                return { ...booking, userEmail: user ? user.email : 'N/A' };
            });
            setFinishedBookings(currentEnrichedFinishedBookings);
        } catch (err) {
            console.error("AdminPage: Error fetching finished bookings:", err);
            setFinishedBookingsError(`Failed to fetch finished bookings: ${err.message}`);
            setFinishedBookings([]); // Clear finished bookings on error
        } finally {
            setFinishedBookingsLoading(false);
        }
        
        // For compatibility with other parts of the app that might use `bookings`
        setBookings([...currentEnrichedOpenBookings, ...currentEnrichedFinishedBookings]);
    }, [isAdmin, currentUser, users]);

    useEffect(() => {
        console.log("AdminPage useEffect: Fetching bookings.");
        fetchBookings();
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
            fetchBookings();
        } catch (err) {
            console.error("handleCreateBooking: Error creating booking:", err);
        } finally {
            setIsCreateFormSubmitting(false);
        }
    }, [currentUser, fetchBookings]);

    const handleUpdateBooking = useCallback(async (id, updatedData) => {
        if (updatedData.status === 'declined') {
            handleDeclineBooking(id, updatedData.userId, editingBooking.calendarEventId, updatedData.declineReason);
            return;
        }
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
                        status: updatedData.status, // Add status to the request
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
            setIsEditModalOpen(false);
            fetchBookings();
        } catch (err) {
            console.error("handleUpdateBooking: Error updating booking:", err);
        } finally {
            setIsEditFormSubmitting(false);
        }
    }, [currentUser, fetchBookings]);

    const handleDeclineBooking = useCallback(async (bookingId, userId, calendarEventId, reason) => {
        console.log("handleDeclineBooking: Attempting to decline booking ID:", bookingId);
        setIsEditFormSubmitting(true);
        try {
            const idToken = await currentUser.getIdToken();
            const response = await fetch(`${import.meta.env.VITE_BACKEND_API_URL}/api/admin/decline-booking`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`,
                },
                body: JSON.stringify({
                    bookingId,
                    userId,
                    calendarEventId,
                    reason,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to decline booking');
            }

            const result = await response.json();
            console.log("handleDeclineBooking: Booking declined successfully:", result);
            setEditingBooking(null);
            setIsEditModalOpen(false);
            fetchBookings();
        } catch (err) {
            console.error("handleDeclineBooking: Error declining booking:", err);
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
            fetchBookings();
        } catch (err) {
            console.error("handleDeleteBooking: Error deleting booking:", err);
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
            fetchBookings();
        } catch (err) {
            console.error("handleConfirmBooking: Error confirming booking:", err);
        }
    }, [currentUser, fetchBookings]);

    const handleFinishBooking = useCallback(async (booking) => {
        console.log("handleFinishBooking: Attempting to finish booking:", booking);
        try {
            const idToken = await currentUser.getIdToken();
            const response = await fetch(`${import.meta.env.VITE_BACKEND_API_URL}/api/admin/bookings/finish`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`,
                },
                body: JSON.stringify({ bookingId: booking.id, userId: booking.userId }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to finish booking');
            }

            const result = await response.json();
            console.log("handleFinishBooking: Booking finished successfully:", result);
            fetchBookings();
        } catch (err) {
            console.error("handleFinishBooking: Error finishing booking:", err);
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
                            usersLoading={usersLoading}
                            usersError={usersError}
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
                    <h2 className="text-2xl font-semibold text-orange-300 mb-6">Pending Bookings ({pendingBookings.length})</h2>
                    {openBookingsLoading ? (
                        <p className="text-center text-orange-200 text-xl mt-8">Loading pending bookings...</p>
                    ) : openBookingsError ? (
                        <p className="text-center text-red-500 text-xl mt-8">Error: {openBookingsError}</p>
                    ) : pendingBookings.length === 0 ? (
                        <p className="text-gray-400 text-center">No pending bookings.</p>
                    ) : (
                        <div className="space-y-4">
                            {pendingBookings.map((booking) => (
                                <div key={booking.id} className="bg-gray-700 p-4 rounded-xl shadow-md flex justify-between items-center">
                                    <div>
                                        <p className="text-lg font-semibold text-gray-200">{booking.userName}</p>
                                        <p className="text-sm text-gray-400">{formatDate(booking.date)} at {formatTime(booking.time)} for {booking.duration} hrs</p>
                                    </div>
                                    <div className="flex space-x-2">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleConfirmBooking(booking); }}
                                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition shadow-lg"
                                        >
                                            Accept
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setEditingBooking(booking); setIsEditModalOpen(true); }} // Use the Edit modal for declining
                                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition shadow-lg"
                                        >
                                            Decline
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="bg-gray-800 shadow-2xl rounded-2xl p-6 mb-8 border border-gray-700">
                    <h2 className="text-2xl font-semibold text-orange-300 mb-6">Add Credits to User</h2>
                    {creditsError && <p className="text-red-500 text-center mb-4">{creditsError}</p>}
                    {creditsSuccess && <p className="text-green-500 text-center mb-4">{creditsSuccess}</p>}
                    {usersLoading ? (
                        <p className="text-center text-orange-200 text-xl mt-8">Loading users...</p>
                    ) : usersError ? (
                        <p className="text-center text-red-500 text-xl mt-8">Error: {usersError}</p>
                    ) : (
                        <div className="flex flex-col space-y-4">
                            <select value={selectedUserIdForCredits} onChange={(e) => setSelectedUserIdForCredits(e.target.value)} className="w-full p-3 border border-gray-600 rounded-xl bg-gray-900 text-white focus:ring focus:ring-orange-500">
                                <option value="" disabled>-- Select a user --</option>
                                {users.map(user => (
                                    <option key={user.id} value={user.id}>{user.displayName || user.email} ({user.email}) - Credits: {user.credits || 0}</option>
                                ))}
                            </select>
                            <input type="number" value={creditsAmount} onChange={(e) => setCreditsAmount(e.target.value)} placeholder="Amount" className="w-full p-3 border border-gray-600 rounded-xl bg-gray-900 text-white focus:ring focus:ring-orange-500" />
                            <button onClick={handleAddCredits} disabled={isAddingCredits} className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition shadow-lg disabled:bg-gray-600">
                                {isAddingCredits ? 'Adding...' : 'Add Credits'}
                            </button>
                        </div>
                    )}
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
                    <h2 className="text-2xl font-semibold text-orange-300 mb-6">Open Bookings ({openBookings.length})</h2>
                    {openBookingsLoading ? (
                        <p className="text-center text-orange-200 text-xl mt-8">Loading open bookings...</p>
                    ) : openBookingsError ? (
                        <p className="text-center text-red-500 text-xl mt-8">Error: {openBookingsError}</p>
                    ) : openBookings.length === 0 ? (
                        <p className="text-gray-400 text-center">No open bookings found.</p>
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
                                    {openBookings.map((booking) => (
                                        <tr key={booking.id} onClick={() => handleShowDetails(booking)} className="cursor-pointer hover:bg-gray-700 transition-colors duration-200">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-100">{booking.userName || 'N/A'} ({booking.userEmail || 'N/A'})</td>
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
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                                    booking.status === 'booking confirmed'
                                                        ? 'bg-green-700 text-green-100'
                                                        : booking.status === 'declined'
                                                            ? 'bg-red-700 text-red-100'
                                                            : 'bg-yellow-700 text-yellow-100'
                                                }`}>
                                                    {booking.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                {isAdmin && (
                                                    <>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setEditingBooking(booking); setIsEditModalOpen(true); }}
                                                            className="text-indigo-400 hover:text-indigo-600 mr-4"
                                                        >
                                                            Edit
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDeleteBooking(booking); }}
                                                            className="text-red-400 hover:text-red-600 mr-4"
                                                        >
                                                            Delete
                                                        </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleFinishBooking(booking); }}
                                                                className="text-green-400 hover:text-green-600"
                                                            >
                                                                Finish
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

                <div className="bg-gray-800 shadow-2xl rounded-2xl p-6 border border-gray-700">
                    <h2 className="text-2xl font-semibold text-orange-300 mb-6">Finished Bookings ({finishedBookings.length})</h2>
                    {finishedBookingsLoading ? (
                        <p className="text-center text-orange-200 text-xl mt-8">Loading finished bookings...</p>
                    ) : finishedBookingsError ? (
                        <p className="text-center text-red-500 text-xl mt-8">Error: {finishedBookingsError}</p>
                    ) : finishedBookings.length === 0 ? (
                        <p className="text-gray-400 text-center">No finished bookings found.</p>
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
                                    {finishedBookings.map((booking) => (
                                        <tr key={booking.id} onClick={() => handleShowDetails(booking)} className="cursor-pointer hover:bg-gray-700 transition-colors duration-200">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-100">{booking.userName || 'N/A'} ({booking.userEmail || 'N/A'})</td>
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
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-700 text-gray-100`}>
                                                    {booking.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                {isAdmin && (
                                                    <>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setEditingBooking(booking); setIsEditModalOpen(true); }}
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
            <EditBookingModal
                show={isEditModalOpen}
                onClose={() => {
                    setEditingBooking(null);
                    setIsEditModalOpen(false);
                }}
                booking={editingBooking}
                onUpdate={handleUpdateBooking}
                isSubmitting={isEditFormSubmitting}
            />
        </div>
    );
};

export default AdminPage;

