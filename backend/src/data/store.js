const pumps = [
  {
    id: "1",
    name: "Kolhapur CNG Pump",
    location: "Kolhapur",
    availability: "HIGH",
    queue: 3,
    distance: "1.2 km",
  },
  {
    id: "2",
    name: "Shivaji Nagar CNG",
    location: "Pune",
    availability: "MEDIUM",
    queue: 7,
    distance: "3.4 km",
  },
  {
    id: "3",
    name: "Kharadi Smart CNG",
    location: "Pune",
    availability: "LOW",
    queue: 12,
    distance: "5.6 km",
  },
  {
    id: "4",
    name: "Thane FastFill CNG",
    location: "Thane",
    availability: "HIGH",
    queue: 2,
    distance: "2.1 km",
  },
];

const slotsByPump = {
  "1": [
    { time: "10:00-10:30", capacity: 5, booked: 2 },
    { time: "10:30-11:00", capacity: 5, booked: 4 },
    { time: "11:00-11:30", capacity: 5, booked: 5 },
    { time: "11:30-12:00", capacity: 5, booked: 1 },
  ],
  "2": [
    { time: "10:00-10:30", capacity: 6, booked: 3 },
    { time: "10:30-11:00", capacity: 6, booked: 6 },
    { time: "11:00-11:30", capacity: 6, booked: 2 },
    { time: "11:30-12:00", capacity: 6, booked: 1 },
  ],
  "3": [
    { time: "10:00-10:30", capacity: 4, booked: 4 },
    { time: "10:30-11:00", capacity: 4, booked: 4 },
    { time: "11:00-11:30", capacity: 4, booked: 3 },
    { time: "11:30-12:00", capacity: 4, booked: 2 },
  ],
  "4": [
    { time: "10:00-10:30", capacity: 5, booked: 1 },
    { time: "10:30-11:00", capacity: 5, booked: 2 },
    { time: "11:00-11:30", capacity: 5, booked: 2 },
    { time: "11:30-12:00", capacity: 5, booked: 0 },
  ],
};

const bookings = [];
let bookingCounter = 1;

function nextBookingToken() {
  const current = bookingCounter;
  bookingCounter += 1;
  return current;
}

module.exports = {
  pumps,
  slotsByPump,
  bookings,
  nextBookingToken,
};
