import React from 'react';
import Modal from './Modal';
import { DJ_EQUIPMENT } from '../constants';

const HOURLY_RATE = 200000;

// EditBookingForm Component
const EditBookingForm = ({ booking, onUpdate, onCancel, isSubmitting }) => {
    const [formData, setFormData] = React.useState({
        ...booking,
        selectedEquipment: booking.equipment ? booking.equipment.map(eq => eq.id) : [],
        userEmail: booking.userEmail || '', // Initialize userEmail
        status: booking.status || 'waiting for confirmation', // Initialize status
        declineReason: '', // Add declineReason to state
    });

    React.useEffect(() => {
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
                <label htmlFor="edit-status" className="block text-sm font-medium text-gray-300 mb-1">Booking Status</label>
                <select id="edit-status" name="status" value={formData.status} onChange={handleChange} className="w-full p-3 border border-gray-600 rounded-xl bg-gray-900 text-white focus:ring focus:ring-orange-500">
                    <option value="waiting for confirmation">Waiting for Confirmation</option>
                    <option value="booking confirmed">Booking Confirmed</option>
                    <option value="declined">Declined</option>
                </select>
            </div>
            {formData.status === 'declined' && (
                <div>
                    <label htmlFor="edit-declineReason" className="block text-sm font-medium text-gray-300 mb-1">Reason for Decline</label>
                    <textarea
                        id="edit-declineReason"
                        name="declineReason"
                        value={formData.declineReason}
                        onChange={handleChange}
                        rows="3"
                        className="w-full p-3 border border-gray-600 rounded-xl bg-gray-900 text-white focus:ring focus:ring-orange-500"
                        placeholder="Explain why the booking is being declined..."
                    ></textarea>
                </div>
            )}
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

const EditBookingModal = ({ show, onClose, booking, onUpdate, isSubmitting }) => {
    if (!show) {
        return null;
    }

    return (
        <Modal show={show} onClose={onClose}>
            <EditBookingForm
                booking={booking}
                onUpdate={onUpdate}
                onCancel={onClose}
                isSubmitting={isSubmitting}
            />
        </Modal>
    );
};

export default EditBookingModal;
