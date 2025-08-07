import React from 'react';
import Modal from './Modal';
import { formatIDR, formatDate, formatTime } from '../utils';

const BookingDetailsModal = ({ show, onClose, booking }) => {
    if (!booking) return null;

    const formatEquipment = (equipment) => {
        if (!equipment || equipment.length === 0) return 'None';
        const players = equipment.filter(item => item.category === 'player').map(item => item.name || item.id);
        const mixers = equipment.filter(item => item.category === 'mixer').map(item => item.name || item.id);
        const extras = equipment.filter(item => item.category === 'extra').map(item => item.name || item.id);

        let equipmentDetails = [];
        if (players.length > 0) equipmentDetails.push(`Players: ${players.join(', ')}`);
        if (mixers.length > 0) equipmentDetails.push(`Mixers: ${mixers.join(', ')}`);
        if (extras.length > 0) equipmentDetails.push(`Extras: ${extras.join(', ')}`);

        return equipmentDetails.join('\n');
    };

    return (
        <Modal show={show} onClose={onClose} title="Booking Details">
            <div className="space-y-3 text-gray-300">
                <p><strong>User Name:</strong> {booking.userName}</p>
                <p><strong>User ID:</strong> {booking.userId}</p>
                <p><strong>User Email:</strong> {booking.userEmail}</p>
                <p><strong>Date:</strong> {formatDate(booking.date)}</p>
                <p><strong>Time:</strong> {formatTime(booking.time)}</p>
                <p><strong>Duration:</strong> {booking.duration} hours</p>
                <p><strong>Total:</strong> {formatIDR(booking.total)}</p>
                <p><strong>Payment Status:</strong> {booking.paymentStatus}</p>
                <p><strong>Booking ID:</strong> {booking.id}</p>
                {booking.calendarEventId && <p><strong>Calendar Event ID:</strong> {booking.calendarEventId}</p>}
                {booking.equipment && booking.equipment.length > 0 && (
                    <div>
                        <strong>Equipment:</strong>
                        <pre className="whitespace-pre-wrap text-gray-400 mt-2 p-3 bg-gray-700 rounded-lg">{formatEquipment(booking.equipment)}</pre>
                    </div>
                )}
            </div>
            <div className="mt-6 text-right">
                <button
                    onClick={onClose}
                    className="px-4 py-2 bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition"
                >
                    Close
                </button>
            </div>
        </Modal>
    );
};

export default BookingDetailsModal;

