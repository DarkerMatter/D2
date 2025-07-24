# D2 Rage Counter

A web application built with Node.js and Express, designed for gamers to track their frustration, deaths, and "rage moments" during gaming sessions. It provides detailed statistics, session management, and data visualization to turn tilting into tangible data.

---

## Features

-   **User Authentication**: Secure user registration and login system.
-   **Session Management**:
    -   Create uniquely named gaming sessions.
    -   View a paginated list of all past sessions.
    -   Rename sessions at any time.
    -   Delete individual sessions and their associated data, with stats correctly updated.
-   **Rage Logging**:
    -   Log a "death" event within a session.
    -   Assign a rage level from 1-10.
    -   Select a common rage phrase to associate with the event.
-   **Data Visualization & Stats**:
    -   **Session Dashboard**: View key stats for each session, including total rage, total deaths, average rage, and the most-used phrase for that session.
    -   **Account Overview**: See lifetime statistics across all sessions.
    -   **Interactive Chart**: A bar chart on the account page visualizes the user's top 5 most-used rage phrases.
-   **Account Control**:
    -   Change account password.
    -   A "Danger Zone" to permanently delete the user's entire history (all sessions and logs).
-   **Admin Panel**:
    -   A protected route for administrators.
    -   View, manage, and delete all users in the system.
    -   Update user permission levels.
-   **Modern UI/UX**:
    -   Clean, dark-themed, and responsive user interface.
    -   Smooth loading animations for data-heavy page transitions.
    -   Interactive UI elements for a dynamic user experience.

---

## Tech Stack

-   **Backend**: Node.js, Express.js
-   **Frontend**: Pug (HTML template engine), CSS3, Vanilla JavaScript
-   **Database**: MySQL
-   **Key Libraries**:
    -   `mysql2`: For database communication.
    -   `express-session`: For managing user sessions.
    -   `bcrypt`: For secure password hashing.
    -   `connect-flash`: For displaying status messages to the user.
    -   `chart.js`: For rendering the statistics chart on the account page.
    -   `dotenv`: For managing environment variables.

---