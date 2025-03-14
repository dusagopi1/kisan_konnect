from pymongo import MongoClient
from bson import ObjectId
from flask_login import UserMixin
import os
from dotenv import load_dotenv
from datetime import datetime
import uuid

# Load environment variables
load_dotenv()

# MongoDB setup
MONGODB_URI = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/')
DATABASE_NAME = os.getenv('DATABASE_NAME', 'user_auth_db')

# MongoDB client with retry settings and proper SSL config
client = MongoClient(
    MONGODB_URI,
    tls=True,
    tlsAllowInvalidCertificates=True,
    serverSelectionTimeoutMS=10000,  # Increased timeout
    connectTimeoutMS=10000,          # Increased timeout
    socketTimeoutMS=10000,           # Increased timeout
    maxPoolSize=50,
    retryWrites=True,
    retryReads=True,
    w='majority',                    # Ensure writes are acknowledged
    readPreference='primaryPreferred'
)

try:
    # Verify the connection
    client.admin.command('ping')
    print("Successfully connected to MongoDB")
except Exception as e:
    print(f"Error connecting to MongoDB: {str(e)}")
    print("MongoDB connection string:", MONGODB_URI)
    raise

db = client[DATABASE_NAME]
users_collection = db['users']
products_collection = db['products']
chats_collection = db['chats']
messages_collection = db['messages']

# Ensure indexes for better query performance
try:
    users_collection.create_index([('username', 1)])
    users_collection.create_index([('email', 1)], unique=True)
    chats_collection.create_index([('participants', 1)])
    messages_collection.create_index([('chat_id', 1), ('created_at', -1)])
    print("Database indexes created successfully")
except Exception as e:
    print(f"Error creating indexes: {str(e)}")
    print("Will continue without indexes")

# Configure upload folder
UPLOAD_FOLDER = 'static/uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

class User(UserMixin):
    def __init__(self, user_data):
        self.id = str(user_data['_id'])
        self.username = user_data['username']
        self.email = user_data['email']

    @staticmethod
    def get_by_username(username):
        user_data = users_collection.find_one({'username': username})
        return User(user_data) if user_data else None

    @staticmethod
    def search_users(query):
        users = users_collection.find({
            'username': {'$regex': query, '$options': 'i'}
        }).limit(10)
        return [User(user) for user in users]

class Chat:
    def __init__(self, participants):
        self.participants = sorted(participants)  # Sort to ensure consistent chat ID
        self.created_at = datetime.utcnow()

    def to_dict(self):
        return {
            'participants': self.participants,
            'created_at': self.created_at
        }

    @staticmethod
    def get_or_create(user1_id, user2_id):
        try:
            print(f"Attempting to get/create chat for users {user1_id} and {user2_id}")
            participants = sorted([str(user1_id), str(user2_id)])
            
            # First try to find existing chat
            chat = chats_collection.find_one({
                'participants': participants
            })
            
            if chat:
                print(f"Found existing chat: {chat['_id']}")
                chat['_id'] = str(chat['_id'])
                return chat
            
            # Create new chat if none exists
            print("No existing chat found, creating new one")
            chat_obj = Chat(participants)
            result = chats_collection.insert_one(chat_obj.to_dict())
            
            if not result.inserted_id:
                raise Exception("Failed to insert new chat")
            
            chat = chats_collection.find_one({'_id': result.inserted_id})
            if not chat:
                raise Exception("Failed to retrieve newly created chat")
            
            chat['_id'] = str(chat['_id'])
            print(f"Successfully created new chat: {chat['_id']}")
            return chat
            
        except Exception as e:
            import traceback
            print(f"Error in get_or_create: {str(e)}")
            print(f"Traceback: {traceback.format_exc()}")
            raise

    @staticmethod
    def get_user_chats(user_id):
        try:
            print(f"Fetching chats for user: {user_id}")
            
            # Verify user exists first
            user = users_collection.find_one({'_id': ObjectId(user_id)})
            if not user:
                raise Exception(f"User {user_id} not found")
            
            # Get all chats for user
            chats = list(chats_collection.find({
                'participants': str(user_id)
            }).sort('created_at', -1))
            
            print(f"Found {len(chats)} chats for user {user_id}")
            
            processed_chats = []
            for chat in chats:
                try:
                    chat['_id'] = str(chat['_id'])
                    # Get the other participant's info
                    other_user_id = next(uid for uid in chat['participants'] if uid != str(user_id))
                    other_user = users_collection.find_one({'_id': ObjectId(other_user_id)})
                    
                    if not other_user:
                        print(f"Warning: Other user {other_user_id} not found for chat {chat['_id']}")
                        continue
                        
                    chat['other_user'] = {
                        'id': str(other_user['_id']),
                        'username': other_user['username']
                    }
                    
                    # Get last message
                    try:
                        last_message = Message.get_chat_last_message(chat['_id'])
                        chat['last_message'] = last_message.to_dict() if last_message else None
                    except Exception as e:
                        print(f"Error getting last message for chat {chat['_id']}: {str(e)}")
                        chat['last_message'] = None
                    
                    processed_chats.append(chat)
                except Exception as e:
                    print(f"Error processing chat {chat.get('_id', 'unknown')}: {str(e)}")
                    continue
            
            print(f"Successfully processed {len(processed_chats)} chats")
            return processed_chats
            
        except Exception as e:
            import traceback
            print(f"Error in get_user_chats: {str(e)}")
            print(f"Traceback: {traceback.format_exc()}")
            raise

    @staticmethod
    def get_by_id(chat_id, current_user_id=None):
        try:
            print(f"Fetching chat {chat_id} for user {current_user_id}")
            
            # Verify chat exists
            chat = chats_collection.find_one({'_id': ObjectId(chat_id)})
            if not chat:
                print(f"Chat {chat_id} not found")
                return None
                
            chat['_id'] = str(chat['_id'])
            
            if current_user_id:
                if str(current_user_id) not in chat['participants']:
                    print(f"User {current_user_id} not authorized for chat {chat_id}")
                    return None
                    
                # Get the other participant's info
                other_user_id = next(uid for uid in chat['participants'] if uid != str(current_user_id))
                other_user = users_collection.find_one({'_id': ObjectId(other_user_id)})
                
                if other_user:
                    chat['other_user'] = {
                        'id': str(other_user['_id']),
                        'username': other_user['username']
                    }
                else:
                    print(f"Warning: Other user {other_user_id} not found for chat {chat_id}")
            
            print(f"Successfully fetched chat {chat_id}")
            return chat
            
        except Exception as e:
            import traceback
            print(f"Error in get_by_id: {str(e)}")
            print(f"Traceback: {traceback.format_exc()}")
            raise

class Message:
    def __init__(self, chat_id, sender_id, content):
        self.chat_id = str(chat_id)
        self.sender_id = str(sender_id)
        self.content = content
        self.created_at = datetime.utcnow()
        self.is_read = False

    def to_dict(self):
        return {
            'chat_id': self.chat_id,
            'sender_id': self.sender_id,
            'content': self.content,
            'created_at': self.created_at,
            'is_read': self.is_read
        }

    def save(self):
        return messages_collection.insert_one(self.to_dict())

    @staticmethod
    def get_chat_messages(chat_id, limit=50):
        messages = list(messages_collection.find({
            'chat_id': str(chat_id)
        }).sort('created_at', 1).limit(limit))
        
        for message in messages:
            message['_id'] = str(message['_id'])
            sender = users_collection.find_one({'_id': ObjectId(message['sender_id'])})
            message['sender_name'] = sender['username'] if sender else 'Unknown'
        
        return messages

    @staticmethod
    def get_chat_last_message(chat_id):
        message = messages_collection.find_one(
            {'chat_id': str(chat_id)},
            sort=[('created_at', -1)]
        )
        if message:
            message['_id'] = str(message['_id'])
            sender = users_collection.find_one({'_id': ObjectId(message['sender_id'])})
            message['sender_name'] = sender['username'] if sender else 'Unknown'
            return Message(
                chat_id=message['chat_id'],
                sender_id=message['sender_id'],
                content=message['content']
            )
        return None

    @staticmethod
    def mark_as_read(chat_id, user_id):
        return messages_collection.update_many(
            {
                'chat_id': str(chat_id),
                'sender_id': {'$ne': str(user_id)},
                'is_read': False
            },
            {'$set': {'is_read': True}}
        )

class Product:
    def __init__(self, name, price, description, image_url, seller_id, quantity=0, unit='kg', category='', harvest_date=None, expiry_date=None, farming_method=''):
        self.name = name
        self.price = float(price)
        self.description = description
        self.image_url = image_url
        self.seller_id = str(seller_id)
        self.quantity = float(quantity)
        self.unit = unit
        self.category = category
        self.harvest_date = harvest_date
        self.expiry_date = expiry_date
        self.farming_method = farming_method
        self.created_at = datetime.utcnow()
        self.seller_name = None  # Will be set by from_dict method

    @staticmethod
    def save_image(image_file):
        """Save the uploaded image and return its URL"""
        if image_file:
            # Generate unique filename
            ext = os.path.splitext(image_file.filename)[1]
            filename = f"{uuid.uuid4()}{ext}"
            
            # Save file
            file_path = os.path.join(UPLOAD_FOLDER, filename)
            image_file.save(file_path)
            
            # Return URL path
            return f"/static/uploads/{filename}"
        return None

    def to_dict(self):
        return {
            'name': self.name,
            'price': self.price,
            'description': self.description,
            'image_url': self.image_url,
            'seller_id': self.seller_id,
            'quantity': self.quantity,
            'unit': self.unit,
            'category': self.category,
            'harvest_date': self.harvest_date,
            'expiry_date': self.expiry_date,
            'farming_method': self.farming_method,
            'created_at': self.created_at
        }

    @staticmethod
    def from_dict(data):
        product = Product(
            name=data['name'],
            price=data['price'],
            description=data['description'],
            image_url=data['image_url'],
            seller_id=data['seller_id'],
            quantity=data.get('quantity', 0),
            unit=data.get('unit', 'kg'),
            category=data.get('category', ''),
            harvest_date=data.get('harvest_date'),
            expiry_date=data.get('expiry_date'),
            farming_method=data.get('farming_method', '')
        )
        product.seller_name = data.get('seller_name', 'Unknown')
        return product

    def save(self):
        return products_collection.insert_one(self.to_dict())

    @staticmethod
    def get_all():
        products = list(products_collection.find().sort('created_at', -1))
        for product in products:
            product['_id'] = str(product['_id'])
            seller = users_collection.find_one({'_id': ObjectId(product['seller_id'])})
            product['seller_name'] = seller['username'] if seller else 'Unknown'
        return products

    @staticmethod
    def get_by_id(product_id):
        product = products_collection.find_one({'_id': ObjectId(product_id)})
        if product:
            product['_id'] = str(product['_id'])
            seller = users_collection.find_one({'_id': ObjectId(product['seller_id'])})
            product['seller_name'] = seller['username'] if seller else 'Unknown'
            return Product.from_dict(product)
        return None

    @staticmethod
    def get_by_seller_id(seller_id):
        """Get all products by a specific seller"""
        products = list(products_collection.find({'seller_id': str(seller_id)}).sort('created_at', -1))
        for product in products:
            product['_id'] = str(product['_id'])
            seller = users_collection.find_one({'_id': ObjectId(product['seller_id'])})
            product['seller_name'] = seller['username'] if seller else 'Unknown'
        return products

    def update(self, product_id):
        """Update an existing product"""
        return products_collection.update_one(
            {'_id': ObjectId(product_id)},
            {'$set': self.to_dict()}
        )

    @staticmethod
    def delete(product_id):
        """Delete a product and its associated image"""
        product = products_collection.find_one({'_id': ObjectId(product_id)})
        if product:
            # Delete the image file if it exists
            if product.get('image_url'):
                image_path = os.path.join(os.getcwd(), product['image_url'].lstrip('/'))
                try:
                    if os.path.exists(image_path):
                        os.remove(image_path)
                except Exception as e:
                    print(f"Error deleting image: {e}")

            # Delete the product from database
            return products_collection.delete_one({'_id': ObjectId(product_id)})
        return None 