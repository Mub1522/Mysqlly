## [0.0.3] - 2025-12-09

### New Features

- **Table Data Viewer**: 
  - Browse table data directly within VS Code.
  - Supports pagination (25 records per page).
  - Clean table layout with scrollable content.

- **Advanced JSON Inspector**: 
  - Automatically detects JSON objects and Arrays in table data.
  - Displays as interactive badges (`{ } Object`, `[ ] Array`) instead of raw strings.
  - Click to open a full modal viewer with syntax highlighting and pretty-printing.
  - One-click "Copy to Clipboard" functionality for JSON data.

- **View Modes**:
  - **Grid View**: Default card-based layout for visualizing tables.
  - **List View**: New compact, vertical list layout for denser information display.

- **Settings Panel**:
  - New configuration UI accessible via the gear icon.
  - Slide-out panel design for clean access to settings.
  - **Toggle Column Details**: Option to show/hide extended column metadata (Type, Nullable, Key, etc.) for a cleaner look.

### UI/UX Improvements

- **Visual Polish**: Improved card styling and dark theme integration.
- **Cleaner Interface**: Removed redundant "Expand" badges for a more professional look.
- **Responsive Design**: Modals and tables adapt efficiently to the editor width.
- **Performance**: Optimized rendering using CSS-based view switching to minimize DOM reflows.