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

app = Flask(__name__)
app.secret_key = os.urandom(24)  # For session management
socketio = SocketIO(app, async_mode='threading', cors_allowed_origins="*", logger=True, engineio_logger=True)

# MongoDB setup
client = MongoClient('mongodb://localhost:27017/')
db = client['user_auth_db']
products_collection = db['products']  # New collection for products

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
    chats = Chat.get_user_chats(current_user.id)
    return render_template('chat/index.html', chats=chats, active_chat=None)

@app.route('/chat/<chat_id>')
@login_required
def chat_detail(chat_id):
    chat = Chat.get_by_id(chat_id, current_user.id)
    if not chat or str(current_user.id) not in chat['participants']:
        flash('Chat not found or access denied')
        return redirect(url_for('chat_index'))
    
    chats = Chat.get_user_chats(current_user.id)
    messages = Message.get_chat_messages(chat_id)
    return render_template('chat/index.html', 
                         chats=chats, 
                         active_chat=chat, 
                         active_chat_id=chat_id,
                         messages=messages)

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
    print('Client connected')

@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected')

@socketio.on('join')
def on_join(data):
    chat_id = data['chat_id']
    join_room(chat_id)
    print(f'Client joined room: {chat_id}')

@socketio.on('leave')
def on_leave(data):
    chat_id = data['chat_id']
    leave_room(chat_id)
    print(f'Client left room: {chat_id}')

@socketio.on('message')
def handle_message(data):
    chat_id = data['chat_id']
    content = data['content']
    
    try:
        message = Message(
            chat_id=chat_id,
            sender_id=current_user.id,
            content=content
        )
        message.save()
        
        emit('message', {
            'sender_id': str(current_user.id),
            'content': content,
            'created_at': message.created_at.isoformat()
        }, room=chat_id)
        print(f'Message sent in room {chat_id}: {content}')
    except Exception as e:
        print(f'Error handling message: {str(e)}')
        emit('error', {'message': 'Failed to send message'}, room=request.sid)

if __name__ == '__main__':
    socketio.run(app, debug=True, allow_unsafe_werkzeug=True, host='0.0.0.0', port=5000) 