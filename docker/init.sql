-- ===============================================
-- MySQL Test Database Initialization Script
-- ===============================================

-- Create sample databases for testing
CREATE DATABASE IF NOT EXISTS sample_db_1;
CREATE DATABASE IF NOT EXISTS sample_db_2;
CREATE DATABASE IF NOT EXISTS ecommerce_db;
CREATE DATABASE IF NOT EXISTS analytics_db;

-- ===============================================
-- SAMPLE_DB_1: User Management System
-- ===============================================
USE sample_db_1;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    date_of_birth DATE,
    phone_number VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login DATETIME,
    INDEX idx_email (email),
    INDEX idx_username (username)
);

CREATE TABLE IF NOT EXISTS user_profiles (
    profile_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    bio TEXT,
    avatar_url VARCHAR(255),
    website VARCHAR(255),
    location VARCHAR(100),
    social_media JSON,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_sessions (
    session_id VARCHAR(64) PRIMARY KEY,
    user_id INT NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Insert sample data
INSERT INTO users (username, email, password_hash, first_name, last_name, date_of_birth, phone_number, is_active, last_login) VALUES 
    ('johndoe', 'john@example.com', '$2y$10$abcdefghijklmnopqrstuv', 'John', 'Doe', '1990-05-15', '+1-555-0101', TRUE, '2024-12-01 10:30:00'),
    ('janesmith', 'jane@example.com', '$2y$10$wxyzabcdefghijklmnopqr', 'Jane', 'Smith', '1988-08-22', '+1-555-0102', TRUE, '2024-12-01 09:15:00'),
    ('bobwilson', 'bob@example.com', '$2y$10$123456789012345678901', 'Bob', 'Wilson', '1995-03-10', '+1-555-0103', TRUE, '2024-11-30 14:20:00'),
    ('alicejones', 'alice@example.com', '$2y$10$987654321098765432109', 'Alice', 'Jones', '1992-11-30', '+1-555-0104', FALSE, '2024-11-28 16:45:00'),
    ('charliebrwn', 'charlie@example.com', '$2y$10$abcd1234efgh5678ijkl', 'Charlie', 'Brown', '1985-07-04', '+1-555-0105', TRUE, '2024-12-01 08:00:00');

INSERT INTO user_profiles (user_id, bio, avatar_url, website, location, social_media) VALUES 
    (1, 'Software developer passionate about open source', 'https://example.com/avatars/john.jpg', 'https://johndoe.dev', 'San Francisco, CA', '{"twitter": "@johndoe", "github": "johndoe"}'),
    (2, 'UX designer and coffee enthusiast', 'https://example.com/avatars/jane.jpg', 'https://janesmith.design', 'New York, NY', '{"linkedin": "janesmith", "dribbble": "janesmith"}'),
    (3, 'Data scientist exploring AI and ML', 'https://example.com/avatars/bob.jpg', NULL, 'Austin, TX', '{"github": "bobwilson", "medium": "@bobwilson"}');

-- ===============================================
-- SAMPLE_DB_2: Blog System
-- ===============================================
USE sample_db_2;

CREATE TABLE IF NOT EXISTS categories (
    category_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS posts (
    post_id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    content LONGTEXT,
    excerpt TEXT,
    category_id INT,
    author_id INT NOT NULL,
    status ENUM('draft', 'published', 'archived') DEFAULT 'draft',
    view_count INT DEFAULT 0,
    published_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE SET NULL,
    INDEX idx_status (status),
    INDEX idx_published_at (published_at)
);

CREATE TABLE IF NOT EXISTS comments (
    comment_id INT AUTO_INCREMENT PRIMARY KEY,
    post_id INT NOT NULL,
    author_name VARCHAR(100),
    author_email VARCHAR(100),
    content TEXT,
    is_approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE
);

-- Insert sample data
INSERT INTO categories (name, slug, description) VALUES 
    ('Technology', 'technology', 'Latest tech news and tutorials'),
    ('Lifestyle', 'lifestyle', 'Tips for better living'),
    ('Travel', 'travel', 'Travel guides and stories'),
    ('Food', 'food', 'Recipes and restaurant reviews');

INSERT INTO posts (title, slug, content, excerpt, category_id, author_id, status, view_count, published_at) VALUES 
    ('Getting Started with MySQL', 'getting-started-mysql', 'This is a comprehensive guide to MySQL...', 'Learn the basics of MySQL database', 1, 1, 'published', 1250, '2024-11-15 10:00:00'),
    ('10 Tips for Productive Mornings', '10-tips-productive-mornings', 'Start your day right with these tips...', 'Maximize your morning productivity', 2, 2, 'published', 3400, '2024-11-20 08:30:00'),
    ('Hidden Gems in Tokyo', 'hidden-gems-tokyo', 'Discover the secret spots in Tokyo...', 'Off the beaten path in Tokyo', 3, 1, 'published', 2100, '2024-11-25 14:00:00'),
    ('The Perfect Homemade Pizza', 'perfect-homemade-pizza', 'Master the art of pizza making...', 'How to make restaurant-quality pizza at home', 4, 3, 'draft', 0, NULL);

INSERT INTO comments (post_id, author_name, author_email, content, is_approved) VALUES 
    (1, 'Sarah Miller', 'sarah@example.com', 'Great tutorial! Very helpful.', TRUE),
    (1, 'Mike Johnson', 'mike@example.com', 'Thanks for sharing this!', TRUE),
    (2, 'Emma Davis', 'emma@example.com', 'I tried tip #3 and it works amazing!', TRUE),
    (3, 'Tom Brown', 'tom@example.com', 'Planning my trip to Tokyo, this is perfect!', FALSE);

-- ===============================================
-- ECOMMERCE_DB: E-commerce System
-- ===============================================
USE ecommerce_db;

CREATE TABLE IF NOT EXISTS customers (
    customer_id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(100) NOT NULL UNIQUE,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    phone VARCHAR(20),
    shipping_address TEXT,
    billing_address TEXT,
    customer_tier ENUM('bronze', 'silver', 'gold', 'platinum') DEFAULT 'bronze',
    total_spent DECIMAL(10, 2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_tier (customer_tier)
);

CREATE TABLE IF NOT EXISTS products (
    product_id INT AUTO_INCREMENT PRIMARY KEY,
    sku VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    price DECIMAL(10, 2) NOT NULL,
    cost DECIMAL(10, 2),
    stock_quantity INT DEFAULT 0,
    weight_kg DECIMAL(8, 3),
    dimensions_cm VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_category (category),
    INDEX idx_sku (sku)
);

CREATE TABLE IF NOT EXISTS orders (
    order_id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    order_number VARCHAR(50) NOT NULL UNIQUE,
    status ENUM('pending', 'processing', 'shipped', 'delivered', 'cancelled') DEFAULT 'pending',
    subtotal DECIMAL(10, 2) NOT NULL,
    tax DECIMAL(10, 2) DEFAULT 0.00,
    shipping DECIMAL(10, 2) DEFAULT 0.00,
    total DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(50),
    shipping_address TEXT,
    notes TEXT,
    ordered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    shipped_at DATETIME,
    delivered_at DATETIME,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
    INDEX idx_order_number (order_number),
    INDEX idx_status (status),
    INDEX idx_customer (customer_id)
);

CREATE TABLE IF NOT EXISTS order_items (
    item_id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id)
);

CREATE TABLE IF NOT EXISTS reviews (
    review_id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    customer_id INT NOT NULL,
    rating TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    title VARCHAR(255),
    comment TEXT,
    is_verified_purchase BOOLEAN DEFAULT FALSE,
    helpful_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(product_id),
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
);

-- Insert sample data
INSERT INTO customers (email, first_name, last_name, phone, shipping_address, customer_tier, total_spent) VALUES 
    ('customer1@example.com', 'Michael', 'Anderson', '+1-555-1001', '123 Main St, Los Angeles, CA 90001', 'gold', 2450.00),
    ('customer2@example.com', 'Emily', 'Taylor', '+1-555-1002', '456 Oak Ave, Chicago, IL 60601', 'silver', 890.50),
    ('customer3@example.com', 'Daniel', 'Martinez', '+1-555-1003', '789 Pine Rd, Houston, TX 77001', 'bronze', 125.00),
    ('customer4@example.com', 'Sophia', 'Garcia', '+1-555-1004', '321 Elm St, Phoenix, AZ 85001', 'platinum', 5600.00);

INSERT INTO products (sku, name, description, category, price, cost, stock_quantity, weight_kg) VALUES 
    ('LAPTOP-001', 'Pro Laptop 15"', 'High-performance laptop with 16GB RAM', 'Electronics', 1299.99, 850.00, 25, 2.100),
    ('PHONE-001', 'Smartphone X', 'Latest smartphone with 5G', 'Electronics', 899.99, 600.00, 50, 0.180),
    ('HEADPHONE-001', 'Wireless Headphones', 'Noise-cancelling over-ear headphones', 'Audio', 249.99, 120.00, 100, 0.280),
    ('MOUSE-001', 'Ergonomic Mouse', 'Wireless ergonomic mouse', 'Accessories', 49.99, 20.00, 200, 0.095),
    ('KEYBOARD-001', 'Mechanical Keyboard', 'RGB mechanical gaming keyboard', 'Accessories', 149.99, 75.00, 75, 1.200),
    ('MONITOR-001', '27" 4K Monitor', 'Professional 4K display', 'Electronics', 599.99, 350.00, 30, 6.500),
    ('TABLET-001', 'Tablet Pro', '12.9" tablet with stylus', 'Electronics', 799.99, 500.00, 40, 0.650);

INSERT INTO orders (customer_id, order_number, status, subtotal, tax, shipping, total, payment_method) VALUES 
    (1, 'ORD-2024-001', 'delivered', 1549.98, 124.00, 15.00, 1688.98, 'credit_card'),
    (2, 'ORD-2024-002', 'shipped', 899.99, 72.00, 10.00, 981.99, 'paypal'),
    (3, 'ORD-2024-003', 'processing', 49.99, 4.00, 5.00, 58.99, 'credit_card'),
    (4, 'ORD-2024-004', 'pending', 949.97, 76.00, 12.00, 1037.97, 'credit_card');

INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal) VALUES 
    (1, 1, 1, 1299.99, 1299.99),
    (1, 3, 1, 249.99, 249.99),
    (2, 2, 1, 899.99, 899.99),
    (3, 4, 1, 49.99, 49.99),
    (4, 5, 1, 149.99, 149.99),
    (4, 7, 1, 799.99, 799.99);

INSERT INTO reviews (product_id, customer_id, rating, title, comment, is_verified_purchase) VALUES 
    (1, 1, 5, 'Excellent laptop!', 'Best laptop I have ever owned. Fast and reliable.', TRUE),
    (3, 1, 4, 'Great sound quality', 'Sound is amazing but a bit heavy for long use.', TRUE),
    (2, 2, 5, 'Love this phone!', 'Camera quality is outstanding and battery lasts all day.', TRUE),
    (4, 3, 3, 'Good but not great', 'Works well but could be more comfortable.', TRUE);

-- ===============================================
-- ANALYTICS_DB: Analytics and Metrics
-- ===============================================
USE analytics_db;

CREATE TABLE IF NOT EXISTS page_views (
    view_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(64),
    user_id INT,
    page_url VARCHAR(500),
    referrer VARCHAR(500),
    user_agent TEXT,
    ip_address VARCHAR(45),
    country VARCHAR(2),
    city VARCHAR(100),
    device_type ENUM('desktop', 'mobile', 'tablet'),
    view_duration_seconds INT,
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_session (session_id),
    INDEX idx_user (user_id),
    INDEX idx_viewed_at (viewed_at)
);

CREATE TABLE IF NOT EXISTS events (
    event_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    event_name VARCHAR(100) NOT NULL,
    event_category VARCHAR(100),
    user_id INT,
    session_id VARCHAR(64),
    event_data JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_event_name (event_name),
    INDEX idx_created_at (created_at)
);

CREATE TABLE IF NOT EXISTS metrics (
    metric_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(15, 4),
    metric_unit VARCHAR(50),
    tags JSON,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_metric_name (metric_name),
    INDEX idx_recorded_at (recorded_at)
);

-- Insert sample data
INSERT INTO page_views (session_id, user_id, page_url, referrer, device_type, view_duration_seconds, country, city) VALUES 
    ('sess_abc123', 1, '/home', 'https://google.com', 'desktop', 45, 'US', 'San Francisco'),
    ('sess_abc123', 1, '/products', '/home', 'desktop', 120, 'US', 'San Francisco'),
    ('sess_def456', 2, '/home', 'https://facebook.com', 'mobile', 30, 'US', 'New York'),
    ('sess_def456', 2, '/about', '/home', 'mobile', 60, 'US', 'New York'),
    ('sess_ghi789', NULL, '/home', 'https://twitter.com', 'tablet', 90, 'GB', 'London');

INSERT INTO events (event_name, event_category, user_id, session_id, event_data) VALUES 
    ('button_click', 'engagement', 1, 'sess_abc123', '{"button_id": "cta_primary", "location": "homepage"}'),
    ('form_submit', 'conversion', 1, 'sess_abc123', '{"form_id": "contact_form", "success": true}'),
    ('video_play', 'engagement', 2, 'sess_def456', '{"video_id": "intro_2024", "duration": 120}'),
    ('purchase', 'conversion', 1, 'sess_abc123', '{"order_id": "ORD-2024-001", "amount": 1688.98}');

INSERT INTO metrics (metric_name, metric_value, metric_unit, tags) VALUES 
    ('response_time_ms', 245.50, 'milliseconds', '{"endpoint": "/api/products", "method": "GET"}'),
    ('cpu_usage', 67.80, 'percent', '{"server": "web-01", "region": "us-west"}'),
    ('memory_usage', 82.30, 'percent', '{"server": "web-01", "region": "us-west"}'),
    ('active_users', 1250.00, 'count', '{"period": "hourly"}'),
    ('conversion_rate', 3.45, 'percent', '{"campaign": "summer_sale"}');
