import React, { useState, useEffect, useContext } from "react";
import { useParams, useNavigate} from "react-router-dom";
import {
  doc,
  getDoc,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  updateDoc,
  arrayUnion,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { AuthContext } from "../context/AuthContext";
import GoogleCalendarIcon from "../assets/google-cal-icon.svg";

  const EventDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user, role } = useContext(AuthContext);
    const [event, setEvent] = useState(null);
    const [isRegistered, setIsRegistered] = useState(false);
    const [registrationCount, setRegistrationCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [registering, setRegistering] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
      const fetchEvent = async () => {
        try {
          const eventDoc = await getDoc(doc(db, "Events", id));
          if (eventDoc.exists()) {
            const eventData = eventDoc.data();
            setEvent(eventData);
          } else {
            setEvent(null);
            setError("Event not found.");
          }
        } catch (error) {
          console.error("Error fetching event:", error);
          setError(
            "An error occured while fetching event details. Please try again."
          );
        } finally {
          setLoading(false);
        }
      };

      const checkRegistration = async () => {
        if (user) {
          const q = query(
            collection(db, "Registrations"),
            where("eventId", "==", id),
            where("userId", "==", user.uid)
          );
          const querySnapshot = await getDocs(q);
          setIsRegistered(!querySnapshot.empty);
        }
      };

      const fetchRegistrationCount = async () => {
        const q = query(
          collection(db, "Registrations"),
          where("eventId", "==", id)
        );
        const querySnapshot = await getDocs(q);
        setRegistrationCount(querySnapshot.size);
      };

      fetchEvent();
      checkRegistration();

      if (role === "staff") {
        fetchRegistrationCount();
      }
    }, [id, user, role]);

    const handleRegistration = async () => {
      if (!user) {
        setError("You must be logged in to register for an event.");
        return;
      }
      try {
        setRegistering(true);
        setError(null);

        if (isRegistered) {
          setError("You are already registered for this event.");
          setRegistering(false);
          return;
        }

        if (event.price > 0) {
          navigate("/payment/" + id, { state: { price: event.price } });
        } else {
          await addDoc(collection(db, "Registrations"), {
            eventId: id,
            userId: user.uid,
            eventTitle: event.title,
            registrationDate: new Date(),
            paymentStatus: "completed",
          });

          const userDocRef = doc(db, "Users", user.uid);
          await updateDoc(userDocRef, {
            eventsRegistered: arrayUnion(id),
          });

          setIsRegistered(true);
        }
      } catch (error) {
        console.error("Error registering for event:", error);
        setError(
          "An error occurred while registering for the event. Please try again."
        );
      } finally {
        setRegistering(false);
      }
    };

    const handleDeleteEvent = async () => {
      if (window.confirm("Are you sure you want to delete this event?")) {
        setDeleting(true);
        try {
          const registrationQuery = query(
            collection(db, "Registrations"),
            where("eventId", "==", id)
          );
          const registrationsSnapshot = await getDocs(registrationQuery);
          const deletePromises = registrationsSnapshot.docs.map((docSnap) =>
            deleteDoc(docSnap.ref)
          );
          await Promise.all(deletePromises);

          await deleteDoc(doc(db, "Events", id));

          navigate("/events");
        } catch (error) {
          console.error("Error deleting event:", error);
          setError(
            "An error occurred while deleting the event. Please try again."
          );
        } finally {
          setDeleting(false);
        }
      }
    };

    const addToGoogleCalendar = () => {
      if (!event) return;

      const { title, description, location, startDateTime, endDateTime } =
        event;

      const start = startDateTime
        .toDate()
        .toISOString()
        .replace(/-|:|\.|Z/g, "");
      const end = endDateTime
        .toDate()
        .toISOString()
        .replace(/-|:|\.|Z/g, "");

      const calendarUrl = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
        title
      )}&details=${encodeURIComponent(
        description
      )}&location=${encodeURIComponent(location)}&dates=${start}/${end}`;

      window.open(calendarUrl, "_blank");
    };

    if (loading) {
      return <div className="loading-text">Loading event details...</div>;
    }

    if (!event) {
      return <div className="loading-text">Event not found.</div>;
    }

    return (
      <div className="event-details-container">
        {event.imageUrl && (
          <img
            src={event.imageUrl}
            alt={event.title}
            className="event-image"
            role="img"
            aria-label={`Image for ${event.title}`}
          />
        )}
        <h2 className="event-title" tabIndex={0}>
          {event.title}
        </h2>
        <p className="event-location" tabIndex={0}>
          {event.location}
        </p>
        <p className="event-datetime" tabIndex={0}>
          Start: {event.startDateTime.toDate().toString()} <br />
          End: {event.endDateTime.toDate().toString()}
        </p>
        <hr className="my-4" />
        <p className="event-description" tabIndex={0}>
          {event.description}
        </p>
        <hr className="my-4" />
        <p className="event-price" tabIndex={0}>
          Price: £{event.price}
        </p>

        <div className="button-container flex justify-center items-center">
          {role === "staff" && (
            <div className="staff-actions mb-4">
              <p className="registration-count flex justify-center">
                Guests Registered: {registrationCount}
              </p>
              <button
                onClick={() => navigate(`/events/${id}/edit`)}
                className="button button-primary mr-2"
                aria-label="Edit Event"
              >
                Edit Event
              </button>
              <button
                onClick={handleDeleteEvent}
                disabled={deleting}
                className={`button button-danger ${
                  deleting ? "button-disabled" : ""
                }`}
                aria-label="Delete Event"
              >
                {deleting ? "Deleting..." : "Delete Event"}
              </button>
            </div>
          )}

          {!isRegistered && user && role !== "staff" && (
            <button
              onClick={handleRegistration}
              disabled={registering}
              className={`button button-primary ${
                registering ? "button-disabled" : ""
              }`}
              aria-label="Sign Up for Event"
            >
              {registering ? "Signing up..." : "Sign Up for Event"}
            </button>
          )}

          {!user && (
            <p className="error-message text-red-600">
              Please log in to sign up for the event.
            </p>
          )}

          {isRegistered && (
            <div className="registration-info">
              <p className="success-message" tabIndex={0}>
                You have registered for this event!
              </p>
              <button
                onClick={addToGoogleCalendar}
                className="button button-primary flex items-center w-full"
                aria-label="Add to Google Calendar"
              >
                <img
                  src={GoogleCalendarIcon}
                  alt="Google Calendar Icon"
                  className="w-5 h-5 inline-block mr-2"
                />
                Add to Google Calendar
              </button>
            </div>
          )}

          {error && (
            <p
              role="alert"
              aria-live="assertive"
              className="error-message text-red-600 mt-4"
            >
              {error}
            </p>
          )}
        </div>
      </div>
    );
  };

export default EventDetails;
