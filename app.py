#!/usr/bin/env python3
# Monkey patch first, before ANY other imports
import eventlet
eventlet.monkey_patch(all=True)

from flask import Flask, render_template, request, redirect, url_for, flash, jsonify
from flask_login import LoginManager, login_user, login_required, logout_user, current_user
import bcrypt
import os
from models import User, Product, Chat, Message, users_collection
from pymongo import MongoClient
from dotenv import load_dotenv
from bson import ObjectId
from flask_socketio import SocketIO, emit, join_room, leave_room

# Load environment variables
load_dotenv()

# Flask app setup
app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY', os.urandom(24))

# Redis URL configuration
REDIS_URL = os.getenv('REDIS_URL', 'redis://red-cva0vm9c1ekc738ophr0:6379')

# SocketIO setup with production-ready configuration
socketio = SocketIO(
    app,
    async_mode='eventlet',
    message_queue=REDIS_URL,
    cors_allowed_origins="*",
    logger=True,
    engineio_logger=True,
    ping_timeout=5000,
    ping_interval=2500,
    max_http_buffer_size=100000000,
    async_handlers=True
)

# MongoDB setup - Keep this as your main database
MONGODB_URI = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/')
DATABASE_NAME = os.getenv('DATABASE_NAME', 'user_auth_db')

client = MongoClient(MONGODB_URI)
db = client[DATABASE_NAME]
products_collection = db['products']

# Flask-Login setup
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

@login_manager.user_loader
def load_user(user_id):
    user_data = users_collection.find_one({'_id': ObjectId(user_id)})
    return User(user_data) if user_data else None

@app.route('/')
def home():
    return render_template('home.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username']
        email = request.form['email']
        password = request.form['password']
        
        # Check if user already exists
        if users_collection.find_one({'email': email}):
            flash('Email already registered')
            return redirect(url_for('register'))
        
        # Hash password
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
        
        # Create new user
        user_data = {
            'username': username,
            'email': email,
            'password': hashed_password
        }
        users_collection.insert_one(user_data)
        flash('Registration successful! Please login.')
        return redirect(url_for('login'))
    
    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form['email']
        password = request.form['password']
        
        user_data = users_collection.find_one({'email': email})
        
        if user_data and bcrypt.checkpw(password.encode('utf-8'), user_data['password']):
            user = User(user_data)
            login_user(user)
            flash('Logged in successfully!')
            return redirect(url_for('dashboard'))
        else:
            flash('Invalid email or password')
            return redirect(url_for('login'))
    
    return render_template('login.html')

@app.route('/dashboard')
@login_required
def dashboard():
    # Fetch all products using the Product model
    products = Product.get_all()
    return render_template('dashboard.html', products=products)

@app.route('/add_product', methods=['GET', 'POST'])
@login_required
def add_product():
    if request.method == 'POST':
        try:
            # Handle image upload
            image = request.files['image']
            image_url = Product.save_image(image)
            
            if not image_url:
                flash('Error uploading image. Please try again.')
                return redirect(url_for('add_product'))

            product = Product(
                name=request.form['name'],
                price=float(request.form['price']),
                description=request.form['description'],
                image_url=image_url,
                seller_id=current_user.id,
                quantity=float(request.form['quantity']),
                unit=request.form['unit'],
                category=request.form['category'],
                harvest_date=request.form['harvest_date'],
                expiry_date=request.form['expiry_date'],
                farming_method=request.form['farming_method']
            )
            product.save()
            flash('Product added successfully!')
            return redirect(url_for('dashboard'))
        except Exception as e:
            flash(f'Error adding product: {str(e)}')
            return redirect(url_for('add_product'))
            
    return render_template('add_product.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    flash('Logged out successfully!')
    return redirect(url_for('home'))

@app.route('/product/<product_id>')
def product_details(product_id):
    product = Product.get_by_id(product_id)
    if not product:
        flash('Product not found', 'error')
        return redirect(url_for('dashboard'))
    return render_template('product_details.html', product=product)

@app.route('/my-products')
@login_required
def my_products():
    products = Product.get_by_seller_id(current_user.id)
    return render_template('my_products.html', products=products)

@app.route('/edit-product/<product_id>', methods=['GET', 'POST'])
@login_required
def edit_product(product_id):
    product = products_collection.find_one({'_id': ObjectId(product_id)})
    
    if not product or str(product['seller_id']) != current_user.id:
        flash('You do not have permission to edit this product')
        return redirect(url_for('dashboard'))
    
    if request.method == 'POST':
        try:
            image_url = product['image_url']
            if 'image' in request.files and request.files['image'].filename:
                # Delete old image if it exists
                if image_url:
                    old_image_path = os.path.join(os.getcwd(), image_url.lstrip('/'))
                    try:
                        if os.path.exists(old_image_path):
                            os.remove(old_image_path)
                    except Exception as e:
                        print(f"Error deleting old image: {e}")
                
                # Save new image
                image = request.files['image']
                image_url = Product.save_image(image)
                
                if not image_url:
                    flash('Error uploading new image. Please try again.')
                    return redirect(url_for('edit_product', product_id=product_id))

            updated_product = Product(
                name=request.form['name'],
                price=float(request.form['price']),
                description=request.form['description'],
                image_url=image_url,
                seller_id=current_user.id,
                quantity=float(request.form['quantity']),
                unit=request.form['unit'],
                category=request.form['category'],
                harvest_date=request.form['harvest_date'],
                expiry_date=request.form['expiry_date'],
                farming_method=request.form['farming_method']
            )
            updated_product.update(product_id)
            flash('Product updated successfully!')
            return redirect(url_for('my_products'))
            
        except Exception as e:
            flash(f'Error updating product: {str(e)}')
            return redirect(url_for('edit_product', product_id=product_id))
    
    return render_template('edit_product.html', product=product)

@app.route('/delete-product/<product_id>')
@login_required
def delete_product(product_id):
    product = products_collection.find_one({'_id': ObjectId(product_id)})
    
    if not product or str(product['seller_id']) != current_user.id:
        flash('You do not have permission to delete this product')
        return redirect(url_for('dashboard'))
    
    try:
        Product.delete(product_id)
        flash('Product deleted successfully!')
    except Exception as e:
        flash(f'Error deleting product: {str(e)}')
    
    return redirect(url_for('my_products'))

@app.route('/chat')
@login_required
def chat_index():
    try:
        print(f"Attempting to load chats for user: {current_user.id}")
        chats = Chat.get_user_chats(current_user.id)
        print(f"Successfully loaded {len(chats) if chats else 0} chats")
        return render_template('chat/index.html', chats=chats, active_chat=None, messages=[])
    except Exception as e:
        import traceback
        print(f"Error in chat_index for user {current_user.id}: {str(e)}")
        print(f"Traceback: {traceback.format_exc()}")
        flash('Unable to load chats at this time. Please try again later.', 'error')
        return redirect(url_for('dashboard'))

@app.route('/chat/<chat_id>')
@login_required
def chat_detail(chat_id):
    try:
        print(f"Loading chat {chat_id} for user {current_user.id}")
        chat = Chat.get_by_id(chat_id, current_user.id)
        
        if not chat:
            print(f"Chat {chat_id} not found")
            flash('Chat not found or access denied')
            return redirect(url_for('chat_index'))
            
        if str(current_user.id) not in chat['participants']:
            print(f"User {current_user.id} not authorized for chat {chat_id}")
            flash('Chat not found or access denied')
            return redirect(url_for('chat_index'))
        
        print("Loading user chats and messages")
        chats = Chat.get_user_chats(current_user.id)
        messages = Message.get_chat_messages(chat_id)
        print(f"Loaded {len(messages)} messages")
        
        return render_template('chat/index.html', 
                             chats=chats, 
                             active_chat=chat, 
                             active_chat_id=chat_id,
                             messages=messages)
    except Exception as e:
        import traceback
        print(f"Error in chat_detail for chat {chat_id}, user {current_user.id}: {str(e)}")
        print(f"Traceback: {traceback.format_exc()}")
        flash('Unable to load chat at this time. Please try again later.', 'error')
        return redirect(url_for('dashboard'))

@app.route('/chat/start/<user_id>')
@login_required
def chat_start(user_id):
    if user_id == current_user.id:
        flash('Cannot start chat with yourself')
        return redirect(url_for('chat_index'))
    
    chat = Chat.get_or_create(current_user.id, user_id)
    return redirect(url_for('chat_detail', chat_id=chat['_id']))

@app.route('/chat/search')
@login_required
def chat_search():
    query = request.args.get('q', '').strip()
    if len(query) < 2:
        return jsonify([])
    
    users = User.search_by_username(query, exclude_id=current_user.id)
    return jsonify([{
        'id': str(user._id),
        'username': user.username
    } for user in users])

@app.route('/chat-users')
@login_required
def chat_users():
    # Get all users except the current user
    all_users = list(users_collection.find({'_id': {'$ne': ObjectId(current_user.id)}}))
    # Convert ObjectId to string for each user
    for user in all_users:
        user['_id'] = str(user['_id'])
    return render_template('chat/users.html', users=all_users)

@socketio.on('connect')
def handle_connect():
    if not current_user.is_authenticated:
        return False  # Reject connection if user is not authenticated
    print(f'Client connected: {current_user.id}')

@socketio.on('disconnect')
def handle_disconnect():
    if current_user.is_authenticated:
        print(f'Client disconnected: {current_user.id}')

@socketio.on('join')
def on_join(data):
    if not current_user.is_authenticated:
        return
    chat_id = data['chat_id']
    # Verify user is part of this chat
    chat = Chat.get_by_id(chat_id)
    if chat and str(current_user.id) in chat['participants']:
        join_room(chat_id)
        print(f'Client {current_user.id} joined room: {chat_id}')

@socketio.on('leave')
def on_leave(data):
    if not current_user.is_authenticated:
        return
    chat_id = data['chat_id']
    leave_room(chat_id)
    print(f'Client {current_user.id} left room: {chat_id}')

@socketio.on('message')
def handle_message(data):
    if not current_user.is_authenticated:
        return
        
    chat_id = data['chat_id']
    content = data['content']
    
    try:
        # Verify user is part of this chat
        chat = Chat.get_by_id(chat_id)
        if not chat or str(current_user.id) not in chat['participants']:
            emit('error', {'message': 'Unauthorized'}, room=request.sid)
            return
            
        message = Message(
            chat_id=chat_id,
            sender_id=current_user.id,
            content=content
        )
        message.save()
        
        # Get sender info
        sender = users_collection.find_one({'_id': ObjectId(current_user.id)})
        
        # Emit message with additional details
        emit('message', {
            'sender_id': str(current_user.id),
            'sender_name': sender['username'],
            'content': content,
            'created_at': message.created_at.isoformat()
        }, room=chat_id)
        print(f'Message sent in room {chat_id} by {current_user.id}: {content}')
    except Exception as e:
        print(f'Error handling message: {str(e)}')
        emit('error', {'message': 'Failed to send message'}, room=request.sid)

if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0', port=5000) 