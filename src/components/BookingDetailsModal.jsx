import React from 'react';
import Modal from './Modal';
import { formatIDR, formatDate, formatTime } from '../../src/utils';

const BookingDetailsModal = ({ show, onClose, booking }) => {
    if (!booking) return null;

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
                        <ul className="list-disc list-inside ml-4">
                            {booking.equipment.map((item, index) => (
                                <li key={index}>{item.name}</li>
                            ))}
                        </ul>
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
