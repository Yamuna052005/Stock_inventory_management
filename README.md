# Smart Inventory & Warehouse Management System

A full-stack inventory and warehouse management system designed to manage products, warehouses, suppliers, purchase orders, stock movements, user roles, and inventory reports.

The application provides role-based access control, secure authentication, stock validation, audit history, reporting, and a responsive dashboard for day-to-day inventory operations.

## Live Demo

**Live Application:** https://stock-inventory-management-x4cp.onrender.com

**GitHub Repository:**
https://github.com/Yamuna052005/Stock_inventory_management

---

## Demo Login Credentials

The following credentials are provided for testing the deployed application.

| Role              | Email                 | Password      |
| ----------------- | --------------------- | ------------- |
| Admin             | `admin@warehouse.com`   | `admin123`   |
| Warehouse Manager | `manager@warehouse.com` | `manager123` |
| Staff             | `staff@warehouse.com`   | `staff123`   |

> **Note:** These credentials are for demonstration/testing purposes only and should not be reused in a production environment.

---

## Project Overview

The Smart Inventory & Warehouse Management System provides a centralized platform for managing inventory across multiple warehouses.

The system supports:

* Product and category management
* Warehouse management
* Supplier management
* Purchase orders
* Stock IN and OUT transactions
* Automatic stock-level updates
* Low-stock monitoring
* Inventory valuation
* Inventory movement reports
* CSV report export
* Role-based permissions
* JWT authentication
* Audit logging
* Inventory history
* Responsive dashboard

The system is designed to prevent invalid inventory operations such as negative stock and maintain a reliable history of inventory changes.

---

## Key Features

### 1. Authentication & Authorization

* JWT-based authentication
* Secure login
* Role-based access control
* Protected routes
* Automatic authorization checks
* Logout functionality

### 2. User Roles

The application supports three roles:

#### Admin

* Manage users
* Manage products
* Manage warehouses
* Manage suppliers
* Manage purchase orders
* View reports
* Access audit logs
* Manage overall system operations

#### Warehouse Manager

* Manage warehouse inventory
* Perform stock IN/OUT operations
* Manage purchase orders
* Monitor low-stock products
* View inventory reports

#### Staff

* View assigned inventory
* Perform permitted stock operations
* View stock information
* Access role-specific functionality

---

## Inventory Management

* Create, update, and archive products
* Product categories
* SKU and barcode support
* Supplier association
* Reorder levels
* Warehouse-specific stock
* Stock IN transactions
* Stock OUT transactions
* Automatic stock quantity updates
* Negative stock prevention
* Inventory movement history
* Low-stock and out-of-stock monitoring

---

## Warehouse Management

* Multiple warehouse support
* Warehouse-specific inventory
* Warehouse capacity tracking
* Inventory distribution across warehouses
* Warehouse stock monitoring

---

## Supplier & Purchase Order Management

* Create and manage suppliers
* Create purchase orders
* Add products to purchase orders
* Track purchase order status
* Receive purchase orders
* Automatically update inventory when stock is received

---

## Dashboard & Reports

The dashboard provides an overview of important inventory metrics.

### Dashboard Metrics

* Total products
* Total stock
* Low-stock products
* Out-of-stock products
* Inventory value
* Warehouse statistics
* Recent stock movements
* Purchase order information

### Reports

* Inventory valuation report
* Stock movement report
* Restocking report
* Date-range filtering
* CSV export

---

## Audit & Inventory History

The system maintains historical records of important inventory operations.

Tracked activities include:

* Stock IN
* Stock OUT
* Product changes
* Purchase order operations
* User actions
* Inventory adjustments

This helps maintain traceability and makes it easier to identify when and how inventory changes occurred.

---

## Technical Highlights

### Transaction Safety

Stock operations are handled using database transactions to ensure that related inventory changes are completed atomically.

For example:

```text
Stock OUT Request
       ↓
Validate Product
       ↓
Check Available Quantity
       ↓
Update Stock
       ↓
Create Movement Record
       ↓
Commit Transaction
```

If an operation fails, the transaction can be rolled back to prevent inconsistent inventory data.

### Negative Stock Prevention

The application prevents stock from becoming negative by validating available inventory before processing stock OUT operations.

Database-level constraints are also used where appropriate to provide an additional layer of protection.

### Soft Archiving

Products are archived instead of permanently deleting them so that historical inventory records remain available.

### Role-Based Authorization

Backend middleware verifies the authenticated user's role before allowing access to protected operations.

---

## Architecture

```text
┌───────────────────────────┐
│      React Frontend       │
│                           │
│ Dashboard / Forms / UI    │
└─────────────┬─────────────┘
              │
              │ REST API
              ▼
┌───────────────────────────┐
│    Node.js + Express      │
│                           │
│ Routes / Controllers      │
│ Middleware / Validation   │
│ Authentication / RBAC     │
└─────────────┬─────────────┘
              │
              │ Database Queries
              ▼
┌───────────────────────────┐
│          SQLite           │
│                           │
│ Products / Stock / Users  │
│ Suppliers / Orders        │
│ Audit Logs / Movements    │
└───────────────────────────┘
```

---

## Tech Stack

### Frontend

* React
* Vite
* JavaScript
* HTML5
* CSS3
* Responsive Design

### Backend

* Node.js
* Express.js
* REST API
* JWT Authentication
* Role-Based Authorization

### Database

* SQLite
* better-sqlite3

### Development & Deployment

* Git
* GitHub
* Docker
* Render

### Testing

* API integration testing
* Isolated test database
* Backend validation testing

---

## Project Structure

```text
Stock_inventory_management/
│
├── client/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── ...
│   └── package.json
│
├── server/
│   ├── routes/
│   ├── controllers/
│   ├── middleware/
│   ├── services/
│   ├── database/
│   └── ...
│
├── tests/
│
├── Dockerfile
├── docker-compose.yml
├── package.json
└── README.md
```

---

## Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/Yamuna052005/Stock_inventory_management.git

cd Stock_inventory_management
```

### 2. Install Dependencies

Install backend dependencies:

```bash
npm install
```

Install frontend dependencies:

```bash
cd client
npm install
cd ..
```

---

## Environment Variables

Create the required environment configuration file based on the project's environment setup.

Example:

```env
PORT=5000
JWT_SECRET=your_jwt_secret
DATABASE_PATH=./database/inventory.db
```

> Do not commit real secrets or production credentials to GitHub.

---

## Database Setup

Run the database migration/setup commands provided by the project.

```bash
npm run migrate
```

Seed the database with demo data:

```bash
npm run seed
```

---

## Run the Application

### Start Backend

```bash
npm run server
```

### Start Frontend

Open another terminal:

```bash
cd client
npm run dev
```

The application will then be available through the Vite development server.

---

## API Documentation

### Authentication

| Method | Endpoint             | Description   |
| ------ | -------------------- | ------------- |
| POST   | `/api/auth/login`    | User login    |
| POST   | `/api/auth/register` | Register user |

### Products

| Method | Endpoint            | Description     |
| ------ | ------------------- | --------------- |
| GET    | `/api/products`     | Get products    |
| POST   | `/api/products`     | Create product  |
| PUT    | `/api/products/:id` | Update product  |
| DELETE | `/api/products/:id` | Archive product |

### Inventory

| Method | Endpoint                   | Description          |
| ------ | -------------------------- | -------------------- |
| GET    | `/api/inventory`           | Get inventory        |
| POST   | `/api/inventory/in`        | Add stock            |
| POST   | `/api/inventory/out`       | Remove stock         |
| GET    | `/api/inventory/movements` | View stock movements |

### Suppliers

| Method | Endpoint             | Description     |
| ------ | -------------------- | --------------- |
| GET    | `/api/suppliers`     | Get suppliers   |
| POST   | `/api/suppliers`     | Create supplier |
| PUT    | `/api/suppliers/:id` | Update supplier |

### Purchase Orders

| Method | Endpoint                           | Description            |
| ------ | ---------------------------------- | ---------------------- |
| GET    | `/api/purchase-orders`             | Get purchase orders    |
| POST   | `/api/purchase-orders`             | Create purchase order  |
| PUT    | `/api/purchase-orders/:id`         | Update purchase order  |
| POST   | `/api/purchase-orders/:id/receive` | Receive purchase order |

> API endpoints may vary depending on the deployed version of the application.

---

## Testing

Run the project's test suite using:

```bash
npm test
```

The test setup uses an isolated database environment to avoid affecting development or production data.

---

## Deployment

The application can be deployed using Docker and platforms such as Render.

### Docker

Build the application:

```bash
docker build -t inventory-management .
```

Run the container:

```bash
docker run -p 5000:5000 inventory-management
```

---

## Security Considerations

* JWT-based authentication
* Password hashing
* Protected API routes
* Role-based authorization
* Input validation
* Database constraints
* Transaction-based stock updates
* Audit logging
* Environment variables for secrets

---

## Future Improvements

Potential future enhancements include:

* Barcode/QR code scanning
* Email notifications for low-stock products
* Advanced analytics
* Supplier performance analytics
* Multi-location transfer workflows
* Cloud database migration to PostgreSQL
* Real-time notifications using WebSockets
* More advanced demand forecasting

---

## Learning & Engineering Outcomes

This project provided practical experience with:

* Full-stack application development
* React component architecture
* REST API development
* Node.js and Express
* JWT authentication
* Role-based access control
* SQLite database design
* Database transactions
* Inventory business logic
* API integration
* Error handling and validation
* Testing
* Docker-based deployment
* Git and GitHub workflows

---

