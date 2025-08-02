# Project Documentation: MOTK Sheets 2 Frontend

This document provides a comprehensive overview of the `motksheets2-frontend` project, detailing its architecture, data flow, and the purpose of each file.

## I. Core Architecture & Principles

### Unidirectional Data Flow

The application is built on the fundamental React principle of a **unidirectional data flow**. This creates a predictable and maintainable state management system.

1.  **Single Source of Truth:** The `AppContainer` component acts as the central hub, holding the definitive state for the entire application. This includes data fetched from Google Sheets (shots, fields, saved views) as well as the current UI state of the data grid (sorting, filtering, column order, etc.).

2.  **State Flows Down:** Data flows in one direction: from the `AppContainer` down to child components. This information is passed as **props**. Child components are "controlled," meaning they are "dumb" and simply render the props they receive without managing their own state.

3.  **Events Flow Up:** When a user interacts with the UI (e.g., sorts a column in the `ShotTable`), the component does not modify its own state directly. Instead, it emits an event by calling a function (a "callback") that was passed down to it as a prop (e.g., `onSortModelChange`).

4.  **State is Updated at the Top:** The callback function lives in `AppContainer`. When called, it updates the central state. This change triggers a re-render of the application, and the new state flows back down to all child components, ensuring the entire UI is consistent.

This architecture prevents bugs caused by different parts of the application having conflicting or out-of-sync state.

---

## II. File & Folder Manifest

This section details the purpose of every file and folder in the project.

### A. Root Directory

- `.gitignore`: A standard Git file that specifies which files and directories should be ignored by version control (e.g., `node_modules`, build artifacts in `dist`).
- `eslint.config.js`: The configuration file for ESLint, a static code analysis tool used to identify and fix stylistic and programmatic errors in the JavaScript/TypeScript code.
- `GEMINI.md`: A markdown file used by the Gemini AI to store session notes, project status, and the development roadmap.
- `index.html`: The main HTML file and the entry point for the application. The Vite development server injects the compiled JavaScript into this file.
- `package.json`: The heart of the Node.js project. It contains metadata (project name, version) and, most importantly, lists all the project's dependencies (`dependencies`) and development dependencies (`devDependencies`). It also defines the scripts (`dev`, `build`, `lint`) used to run, build, and test the application.
- `package-lock.json`: An auto-generated file that records the exact version of every single dependency and sub-dependency. This guarantees that the project can be installed consistently across different machines.
- `postcss.config.cjs` & `tailwind.config.cjs`: Configuration files for PostCSS and Tailwind CSS. Tailwind is a utility-first CSS framework that allows for rapid styling directly in the HTML/JSX. PostCSS is a tool that transforms CSS with JavaScript plugins.
- `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`: Configuration files for the TypeScript compiler. They define how TypeScript code (`.ts`, `.tsx`) should be checked and compiled into JavaScript.
- `vite.config.ts`: The main configuration file for Vite, the high-performance build tool and development server used for this project. It includes settings for plugins, the dev server port, and security headers.

### B. `/src/` - Application Source Code

#### `/src/api/` - Data Writing Logic

This directory contains functions responsible for **sending data _to_ the Google Sheets API**. Each file typically corresponds to a specific write action.

- `appendField.js`: Adds a new field (column) to the database. This is a complex batch operation that modifies both the `FIELDS` sheet (to define the new field) and the `Shots` sheet (to add the new column).
- `appendPage.js`: Appends a new row to the `PAGES` sheet. This is used to save a new view configuration.
- `appendRow.js`: Appends a new row to the `Shots` sheet. This is used when creating a new shot.
- `batchUpdate.js`: A generic utility for sending multiple update requests to the Google Sheets API in a single call, which is more efficient than sending many individual requests.
- `deletePage.js`: Deletes a row from the `PAGES` sheet, effectively deleting a saved view.
- `deleteRows.js`: Deletes one or more rows from the `Shots` sheet.
- `sheetUtils.js`: Contains helper functions for sheet-related operations, such as `ensureSheetExists`, which checks if a sheet with a given name exists and creates it if it doesn't.
- `updateCell.js`: Updates the value of a single cell in the `Shots` sheet. This is called after a user edits a cell in the data grid.
- `updateNonUuidIds.js`: A utility function to find any rows that have old, non-standard IDs and replace them with proper, unique UUIDs to maintain data integrity.
- `updatePage.js`: Updates an entire existing row in the `PAGES` sheet. This is used to save changes to an existing view.

#### `/src/components/` - UI Components (The View Layer)

This directory contains the reusable React components that form the visual part of the application.

- `AppContainer.jsx`: The top-level component and the "brain" of the application. It orchestrates data fetching, state management, and renders all other components.
- `AddShotPage.jsx`: The dedicated page/form for creating a new shot.
- `AuthCallbackHandler.jsx`: A component that handles the redirect from Google's OAuth 2.0 sign-in flow.
- `ErrorBoundary.jsx`: A safety-net component. It wraps the entire application and will display a fallback UI instead of a white screen of death if a JavaScript error occurs anywhere in the component tree.
- `FieldManager.jsx`: The UI dropdown/menu for managing the table's columns (e.g., adding new fields).
- `FilterManager.jsx`: The UI dropdown/menu for managing data filtering rules.
- `FullScreenSpinner.jsx`: A loading indicator that covers the entire screen, used when the application is performing a critical initial data load.
- `GlobalNav.jsx`: The main navigation bar at the top of the application.
- `Home.jsx`: The primary layout component for the main page. It arranges the `Toolbar` and `ShotTable` components.
- `LoginButton.jsx`: The button that initiates the Google Sign-In process.
- `ManageViewsDialog.jsx`: The dialog box that allows users to save, rename, and delete their saved view configurations.
- `MissingIdDialog.jsx`: A dialog that appears to warn the user if some shots are missing unique IDs.
- `PageView.jsx`: A component likely intended for displaying a single, non-editable page of data (purpose may have evolved).
- `ReAuthDialog.jsx`: A dialog that prompts the user to sign in again if their authentication token has expired.
- `SavedFilters.jsx`: A component for managing and applying pre-saved sets of filters.
- `ShotDetailPage.jsx`: A page that would show all the details for a single selected shot.
- `ShotTable.tsx`: The most complex component. It renders the main data grid using the MUI X DataGrid library. It is responsible for displaying all the shot data and handling user interactions like editing, sorting, and selection.
- `SortableHeaderCell.jsx`: A custom header cell component that was likely used to enable drag-and-drop column reordering before this was replaced by the DataGrid's native functionality.
- `Toolbar.jsx`: The main toolbar that sits above the `ShotTable`. It contains the view selector dropdown, filter/sort controls, and action buttons like "Add New Shot".
- `UpdateNonUuidIdsDialog.jsx`: The dialog interface for the `updateNonUuidIds` utility function.

#### `/src/contexts/` - Shared Application State

This directory uses React's Context API to provide global state to the entire application, avoiding the need to pass props down through many layers of components (a problem known as "prop drilling").

- `AuthContext.jsx`: Provides authentication-related information, such as the user's access token and sign-in status, to any component that needs it.
- `SheetsContext.jsx`: Holds and provides the ID of the currently selected Google Sheet.
- `SheetsDataContext.jsx`: Holds and provides the data fetched from the Google Sheets (shots and fields) to any component that needs it.

#### `/src/hooks/` - Data Fetching Logic

This directory contains custom React Hooks, which are reusable functions for encapsulating logic, particularly for fetching and managing data.

- `useDriveSheets.js`: A hook that communicates with the Google Drive API to fetch a list of all Google Sheets available to the user.
- `usePagesData.js`: A hook that fetches and parses the saved view configurations from the `PAGES` sheet.
- `useSheetsData.js`: A hook that fetches and parses the main shot data from the `Shots` sheet and the field definitions from the `FIELDS` sheet.

#### `/src/pages/` - Application Pages

This directory holds the top-level components for each distinct "page" in the application.

- `ProjectSelectPage.jsx`: The initial page the user sees after logging in, where they select which spreadsheet to work on.
- `ShotsPage.jsx`: The main page of the application that renders the `Home` component, which in turn renders the `Toolbar` and `ShotTable`.

#### `/src/routes/` - Route Definitions

- `ProtectedRoutes.jsx`: A component that uses the `react-router-dom` library to protect certain routes. It acts as a "gatekeeper," checking if a user is logged in before allowing them to access a specific page. If not, it redirects them to the sign-in page.

#### `/src/utils/` - Utility Functions

This directory contains miscellaneous helper functions that are used across the application.

- `api.js`: A general-purpose API utility. It appears to be an older version or alternative to `google.js`.
- `google.js`: A crucial utility that acts as a wrapper around the native `fetch` API. It simplifies making requests to the Google APIs by automatically adding the required authentication token to the headers and handling the process of refreshing an expired token.
- `id.js` & `idGenerator.js`: A set of functions for creating and validating unique identifiers (IDs) for shots, fields, and other entities within the application.
- `missingIdHandler.js`: A data-cleaning utility that scans for shots missing a unique ID and assigns a new one, ensuring data integrity.
- `parse.js`: Contains functions that are essential for transforming the raw, two-dimensional array data from Google Sheets into a more structured and usable JavaScript object format.
- `sheetSync.js`: A utility specifically for syncing data _back_ to Google Sheets, such as writing newly generated IDs to the correct cells.

#### `/src/mock/` - Mock Data

This directory contains static `.json` files that serve as placeholder data for development and testing. This allows the UI to be built and tested without needing a live connection to the Google Sheets API.

- `fields.json`: Mock data representing the structure of the `FIELDS` sheet.
- `shots.json`: Mock data representing a small list of shots from the `Shots` sheet.
