# Farmer's Market E-commerce Platform

A web application that connects farmers directly with consumers, featuring real-time chat functionality and product management.

## Features

- User Authentication (Login/Register)
- Product Management (Add, Edit, Delete)
- Real-time Chat System
- Product Categories and Search
- Detailed Product Views
- Responsive Design

## Tech Stack

- Python 3.12
- Flask
- MongoDB
- Socket.IO
- HTML/CSS
- JavaScript

## Prerequisites

- Python 3.12 or higher
- MongoDB
- Git

## Local Development Setup

1. Clone the repository:
```bash
git clone <your-repository-url>
cd <repository-name>
```

2. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Create a `.env` file in the root directory:
```
MONGODB_URI=mongodb://localhost:27017/
DATABASE_NAME=user_auth_db
SECRET_KEY=your_secret_key
```

5. Run the application:
```bash
python app.py
```

## Deployment on Render

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Configure the following:
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `gunicorn app:app`
   - Environment Variables:
     - `MONGODB_URI` (Your MongoDB connection string)
     - `DATABASE_NAME` (Your database name)
     - `SECRET_KEY` (Your secret key)

## Project Structure

```
├── app.py              # Main application file
├── models.py           # Database models
├── requirements.txt    # Project dependencies
├── static/            # Static files (CSS, JS)
├── templates/         # HTML templates
│   ├── base.html
│   ├── chat/
│   └── ...
└── uploads/           # User uploaded files
```

## Contributing

1. Fork the repository
2. Create a new branch
3. Make your changes
4. Submit a pull request

## License

This project is licensed under the MIT License. 