from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from flask_cors import CORS
import bcrypt
import pytesseract
# pylint: disable=no-member
import cv2
import os
import re
from datetime import datetime, timedelta
from io import BytesIO
from flask import send_file
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle
from reportlab.lib import colors

pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
# Initialize Flask app
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "http://localhost:3000"}}, supports_credentials=True)

app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=1)
app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://postgres:Sasuke%40123@localhost/eeris'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = 'your_secret_key'
app.config['JWT_IDENTITY_CLAIM'] = 'identity'

db = SQLAlchemy(app)
jwt = JWTManager(app)

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Models
class UserRole(db.Model):
    __tablename__ = 'user_roles'
    id = db.Column(db.Integer, primary_key=True)
    role = db.Column(db.String(20), unique=True, nullable=False)
    description = db.Column(db.Text)

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    role_id = db.Column(db.Integer, db.ForeignKey('user_roles.id'), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)

class Receipt(db.Model):
    __tablename__ = 'receipts'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    category = db.Column(db.String(50), default='Unknown', nullable=False)
    amount = db.Column(db.Float, nullable=True)
    status = db.Column(db.String(20), default='Pending', nullable=False)
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    extracted_text = db.Column(db.Text)
    store_name = db.Column(db.String(50), default='Unknown')

class ReceiptItem(db.Model):
    __tablename__ = 'receipt_items'
    id = db.Column(db.Integer, primary_key=True)
    receipt_id = db.Column(db.Integer, db.ForeignKey('receipts.id', ondelete="CASCADE"), nullable=False)
    item_name = db.Column(db.String(255), nullable=False)
    amount = db.Column(db.Numeric(10, 2), nullable=False)

class ReceiptAudit(db.Model):
    __tablename__ = 'receipt_audit'
    id = db.Column(db.Integer, primary_key=True)
    receipt_id = db.Column(db.Integer, db.ForeignKey('receipts.id', ondelete="CASCADE"), nullable=False)
    supervisor_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete="SET NULL"))
    action = db.Column(db.String(20), nullable=False)
    action_timestamp = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    comments = db.Column(db.Text)

# OCR text extractor
def extract_text(image_path):
    image = cv2.imread(image_path)
    if image is None:
        return {"error": "Could not read the image."}

    text = pytesseract.image_to_string(image)

    # Extract total amount
    amount_match = re.search(r"\$\s?(\d+\.\d{2})", text)
    total_amount = float(amount_match.group(1)) if amount_match else None

    # Extract store name (first line)
    store_name = text.split('\n')[0].strip() if text else 'Unknown'

    # Extract receipt date
    date_match = re.search(r"(\d{2}/\d{2}/\d{4})", text)
    receipt_date = date_match.group(1) if date_match else None

    # Smart category detection
    def detect_category(text):
        text_lower = text.lower()
        if any(keyword in text_lower for keyword in ["walmart", "target", "publix", "grocery", "supermarket", "aldi", "costco"]):
            return "Groceries"
        elif any(keyword in text_lower for keyword in ["airlines", "flight", "delta", "american airlines", "united airlines", "airport"]):
            return "Flight"
        elif any(keyword in text_lower for keyword in ["uber", "lyft", "taxi", "transport", "bus", "train", "subway"]):
            return "Transportation"
        elif any(keyword in text_lower for keyword in ["home depot", "lowe's", "hardware", "tools", "material", "construction"]):
            return "Materials/Tools"
        elif any(keyword in text_lower for keyword in ["hotel", "motel", "inn", "resort", "bnb"]):
            return "Lodging"
        elif any(keyword in text_lower for keyword in ["restaurant", "dining", "food", "pizza", "burger", "cafe", "steakhouse"]):
            return "Meals"
        else:
            return "Other"

    category = detect_category(text)

    # Extract items and promotions
    items = []
    lines = text.split('\n')
    last_item_name = None
    i = 0

    while i < len(lines):
        line = lines[i].strip()
        line_lower = line.lower()

        if any(keyword in line_lower for keyword in ["order total", "sales tax", "grand total", "change", "amount", "balance", "payment", "cash", "subtotal", "savings summary", "special price savings"]):
            break

        if "promotion" in line_lower:
            match = re.search(r"promotion\s+\-?\$?\s*(\d+\.\d{2})", line_lower)
            if match and last_item_name:
                promo_price = float(match.group(1))
                items.append((f"Promotion for {last_item_name}", -abs(promo_price)))
            i += 1
            continue

        match = re.search(r"(.+?)\s+\$?\s*(\d+\.\d{2})", line)
        if match:
            item_name = match.group(1).strip()
            item_price = float(match.group(2))
            items.append((item_name, item_price))
            last_item_name = item_name

        i += 1

    return {
        "raw_text": text,
        "amount": total_amount,
        "store_name": store_name,
        "receipt_date": receipt_date,
        "category": category,
        "items": items
    }

# Routes
@app.route('/')
def home():
    return jsonify({"message": "EERIS Backend Running"})

@app.route('/register', methods=['POST'])
def register():
    data = request.json
    name, email, password, role_id = data.get('name'), data.get('email'), data.get('password'), data.get('role_id')

    if not (name and email and password and role_id):
        return jsonify({"error": "All fields are required"}), 400

    hashed_pw = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    new_user = User(name=name, email=email, password_hash=hashed_pw, role_id=role_id)
    db.session.add(new_user)
    db.session.commit()

    return jsonify({"message": "User registered successfully!"})

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    email, password = data.get('email'), data.get('password')

    user = User.query.filter_by(email=email).first()
    if not user or not bcrypt.checkpw(password.encode('utf-8'), user.password_hash.encode('utf-8')):
        return jsonify({"error": "Invalid credentials"}), 401

    role_obj = UserRole.query.get(user.role_id)
    role = role_obj.role.lower() if role_obj else "unknown"

    token = create_access_token(identity=str(user.id))
    return jsonify({"message": "Login successful", "token": token, "role": role})

@app.route('/all-expense-history', methods=['GET'])
@jwt_required()
def all_expense_history():
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    role = UserRole.query.get(user.role_id)

    if not role or role.role.lower() not in ['admin', 'supervisor']:
        return jsonify({"error": "Access denied"}), 403

    receipts = Receipt.query.order_by(Receipt.uploaded_at.desc()).all()
    history = []

    for receipt in receipts:
        user = User.query.get(receipt.user_id)
        items = ReceiptItem.query.filter_by(receipt_id=receipt.id).all()
        history.append({
            "user_name": user.name if user else "Unknown User",
            "receipt_id": receipt.id,
            "store_name": receipt.store_name,
            "category": receipt.category,
            "amount": float(receipt.amount) if receipt.amount else 0.00,
            "status": receipt.status,
            "uploaded_at": receipt.uploaded_at.strftime('%Y-%m-%d %H:%M:%S'),
            "items": [{"name": i.item_name, "amount": str(i.amount)} for i in items]
        })

    return jsonify({"history": history}), 200


@app.route('/upload-receipt', methods=['POST'])
@jwt_required()
def upload_receipt():
    if 'receipt' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files['receipt']
    file_path = os.path.join(UPLOAD_FOLDER, file.filename)
    file.save(file_path)

    extracted_data = extract_text(file_path)

    if "error" in extracted_data:
        return jsonify({"error": extracted_data["error"]}), 400

    # ⚡ Only return extracted data, do NOT insert into database here!
    return jsonify({
        "message": "OCR extraction successful",
        "store_name": extracted_data["store_name"],
        "category": extracted_data["category"],
        "total_amount": extracted_data["amount"],
        "items": [
            {"name": item_name, "amount": item_price}
            for item_name, item_price in extracted_data["items"]
        ]
    }), 200


@app.route('/manual-receipt', methods=['POST'])
@jwt_required()
def create_receipt_with_items():
    data = request.get_json()

    if not data:
        return jsonify({"error": "Invalid or missing JSON data"}), 400

    user_id = int(get_jwt_identity())

    # ✅ Safely filter items before processing
    items = data.get('items', [])
    valid_items = [
        item for item in items
        if item.get('amount') not in [None, '', 0]
    ]

    # ✅ Sum only valid items
    total_amount = sum(
        float(item['amount']) for item in valid_items
    )

    # 1. Insert new Receipt record
    new_receipt = Receipt(
        user_id=user_id,
        store_name=data.get('store'),
        category=data.get('category'),
        amount=total_amount
    )
    db.session.add(new_receipt)
    db.session.flush()  # Get new_receipt.id before inserting items

    # 2. Insert Receipt Items
    for item in valid_items:
        receipt_item = ReceiptItem(
            receipt_id=new_receipt.id,
            item_name=item.get('name', 'Unknown Item'),
            amount=float(item.get('amount'))
        )
        db.session.add(receipt_item)

    # 3. Commit everything
    db.session.commit()

    return jsonify({"message": "Receipt and items submitted successfully!"}), 201


@app.route('/fetch-receipts', methods=['GET'])
@jwt_required()
def fetch_receipts():
    identity = get_jwt_identity()
    user_id = int(identity)

    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    role = UserRole.query.get(user.role_id)
    if not role:
        return jsonify({"error": "User role not found"}), 404

    if role.role.lower() in ['supervisor', 'admin']:
        receipts = Receipt.query.all()
    else:
        receipts = Receipt.query.filter_by(user_id=user_id).all()

    receipt_list = [{
        "id": receipt.id,
        "user": receipt.user_id,
        "uploadDate": receipt.uploaded_at.isoformat(),
        "amount": str(receipt.amount) if receipt.amount else "0.00",
        "category": receipt.category,
        "storeName": receipt.store_name or "Unknown Store",
        "status": receipt.status
    } for receipt in receipts]

    return jsonify({
        "receipts": receipt_list,
        "role": role.role.lower()
    }), 200

@app.route('/user-expense-history', methods=['GET'])
@jwt_required()
def user_expense_history():
    user_id = int(get_jwt_identity())

    receipts = Receipt.query.filter_by(user_id=user_id).order_by(Receipt.uploaded_at.desc()).all()
    
    history = []
    for receipt in receipts:
        items = ReceiptItem.query.filter_by(receipt_id=receipt.id).all()
        history.append({
            "receipt_id": receipt.id,
            "store_name": receipt.store_name,
            "category": receipt.category,
            "amount": float(receipt.amount) if receipt.amount else 0.00,
            "status": receipt.status,
            "uploaded_at": receipt.uploaded_at.strftime('%Y-%m-%d %H:%M:%S'),
            "items": [{"name": i.item_name, "amount": str(i.amount)} for i in items]
        })

    return jsonify({"history": history}), 200


@app.route('/statistics', methods=['GET'])
@jwt_required()
def get_statistics():
    identity = get_jwt_identity()
    user_id = int(identity)

    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    role = UserRole.query.get(user.role_id)
    if not role:
        return jsonify({"error": "User role not found"}), 404

    # Supervisor sees all receipts, employee sees only their own
    if role.role.lower() in ['supervisor', 'admin']:
        receipts = Receipt.query.all()
    else:
        receipts = Receipt.query.filter_by(user_id=user_id).all()

    # ✅ EXCLUDE rejected receipts from CATEGORY calculations (but not from status counts)
    valid_receipts = [r for r in receipts if r.status.lower() != 'rejected']

    # Group and Sum by Category
    category_totals = {}
    for r in valid_receipts:
        if r.category not in category_totals:
            category_totals[r.category] = 0.0
        if r.amount:
            category_totals[r.category] += float(r.amount)

    response = {
        "category_totals": category_totals
    }

    # ✅ Count all receipt statuses
    approvals = sum(1 for r in receipts if r.status.lower() == 'approved')
    rejections = sum(1 for r in receipts if r.status.lower() == 'rejected')
    pending = sum(1 for r in receipts if r.status.lower() == 'pending')

    response["approvals"] = approvals
    response["rejections"] = rejections
    response["pending"] = pending

    # Supervisor extras: by store and by user
    if role.role.lower() in ['supervisor', 'admin']:
        # Group and Sum by Store
        store_totals = {}
        store_categories = {}

        for r in valid_receipts:
            store = r.store_name or "Unknown Store"
            if store not in store_totals:
                store_totals[store] = 0.0
                store_categories[store] = {}

            if r.amount:
                store_totals[store] += float(r.amount)

                cat = r.category
                if cat not in store_categories[store]:
                    store_categories[store][cat] = 0.0
                store_categories[store][cat] += float(r.amount)

        # Find the main (max) category for each store
        store_main_categories = {}
        for store, cats in store_categories.items():
            if cats:
                main_cat = max(cats.items(), key=lambda x: x[1])[0]
                store_main_categories[store] = main_cat
            else:
                store_main_categories[store] = "unknown"

        response["store_totals"] = store_totals
        response["store_main_categories"] = store_main_categories

    # Group and Sum by User
    user_totals = {}
    for r in valid_receipts:
        user_obj = User.query.get(r.user_id)
        user_name = user_obj.name if user_obj else "Unknown User"

        if user_name not in user_totals:
            user_totals[user_name] = 0.0
        if r.amount:
            user_totals[user_name] += float(r.amount)

    response["user_totals"] = user_totals

    return jsonify(response), 200


@app.route('/receipt-details/<int:receipt_id>', methods=['GET'])
@jwt_required()
def get_receipt_details(receipt_id):
    receipt = Receipt.query.get(receipt_id)

    if not receipt:
        return jsonify({"error": "Receipt not found"}), 404

    # Fetch items
    items = ReceiptItem.query.filter_by(receipt_id=receipt_id).all()

    # Fetch user who submitted
    user = User.query.get(receipt.user_id)

    return jsonify({
        "items": [{"item_name": item.item_name, "amount": str(item.amount)} for item in items],
        "user_name": user.name if user else "Unknown User"
    }), 200

@app.route('/update-receipt-status/<int:receipt_id>', methods=['POST'])
@jwt_required()
def update_receipt_status(receipt_id):
    data = request.get_json()
    new_status = data.get('status')

    if new_status not in ['Approved', 'Rejected']:
        return jsonify({"error": "Invalid status"}), 400

    receipt = Receipt.query.get(receipt_id)
    if not receipt:
        return jsonify({"error": "Receipt not found"}), 404

    receipt.status = new_status
    db.session.commit()

    return jsonify({"message": f"Receipt status updated to {new_status}!"}), 200

@app.route('/delete-receipt/<int:receipt_id>', methods=['DELETE'])
@jwt_required()
def delete_receipt(receipt_id):
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    role = UserRole.query.get(user.role_id)
    if role.role.lower() != "admin":
        return jsonify({"error": "Only admins can delete receipts"}), 403

    receipt = Receipt.query.get(receipt_id)
    if not receipt:
        return jsonify({"error": "Receipt not found"}), 404

    db.session.delete(receipt)
    db.session.commit()
    return jsonify({"message": "Receipt deleted successfully"}), 200


@app.route('/audit-logs', methods=['GET'])
@jwt_required()
def get_audit_logs():
    logs = ReceiptAudit.query.all()

    audit_list = [{
        'id': log.id,
        'receipt_id': log.receipt_id,
        'supervisor_id': log.supervisor_id,
        'action': log.action,
        'action_timestamp': log.action_timestamp.strftime('%Y-%m-%d %H:%M:%S'),
        'comments': log.comments
    } for log in logs]

    return jsonify({"audit_logs": audit_list})

# Get all users (admin only)
@app.route('/all-users', methods=['GET'])
@jwt_required()
def get_all_users():
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    role = UserRole.query.get(user.role_id)
    if role.role.lower() != "admin":
        return jsonify({"error": "Access forbidden"}), 403

    users = User.query.all()
    users_list = [{
        "id": u.id,
        "name": u.name,
        "email": u.email,
        "role": UserRole.query.get(u.role_id).role if u.role_id else "Unknown"
    } for u in users]

    return jsonify({"users": users_list}), 200

# Update user role
@app.route('/update-user-role/<int:user_id>', methods=['POST'])
@jwt_required()
def update_user_role(user_id):
    data = request.get_json()
    new_role = data.get('role')

    role_obj = UserRole.query.filter_by(role=new_role).first()
    if not role_obj:
        return jsonify({"error": "Invalid role"}), 400

    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    user.role_id = role_obj.id
    db.session.commit()

    return jsonify({"message": "User role updated successfully"}), 200

@app.route('/change-password', methods=['POST'])
@jwt_required()
def change_password():
    data = request.json
    current_password = data.get('current_password')
    new_password = data.get('new_password')

    user_id = get_jwt_identity()  # ✅ CORRECT (no ['id'])
    user = User.query.get(int(user_id))  # ✅ safer with int()

    if not user:
        return jsonify({"error": "User not found"}), 404

    # Check if current password is correct
    if not bcrypt.checkpw(current_password.encode('utf-8'), user.password_hash.encode('utf-8')):
        return jsonify({"error": "Current password is incorrect"}), 400

    # Hash and save the new password
    user.password_hash = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    db.session.commit()

    return jsonify({"message": "Password changed successfully!"})

@app.route('/delete-account', methods=['DELETE'])
@jwt_required()
def delete_account():
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    db.session.delete(user)
    db.session.commit()

    return jsonify({"message": "Account deleted successfully!"}), 200

@app.route('/delete-user/<int:user_id>', methods=['DELETE'])
@jwt_required()
def delete_user_by_admin(user_id):
    current_user_id = int(get_jwt_identity())
    current_user = User.query.get(current_user_id)
    role = UserRole.query.get(current_user.role_id)
    
    if not current_user or not role or role.role.lower() != "admin":
        return jsonify({"error": "Unauthorized"}), 403

    if user_id == current_user_id:
        return jsonify({"error": "Cannot delete your own account."}), 400

    user_to_delete = User.query.get(user_id)
    if not user_to_delete:
        return jsonify({"error": "User not found"}), 404

    db.session.delete(user_to_delete)
    db.session.commit()
    return jsonify({"message": "User deleted successfully!"}), 200


# App Runner
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)

