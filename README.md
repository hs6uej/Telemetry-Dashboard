# 🌊 ระบบข้อมูลโทรมาตรอัตโนมัติ (Telemetry Dashboard)

ระบบ Dashboard แสดงผลข้อมูลระดับน้ำและปริมาณน้ำฝนแบบ Real-time บนแผนที่เชิงพื้นที่ (Interactive Web Map) พร้อมระบบบริหารจัดการข้อมูลหลังบ้าน

## ✨ ฟีเจอร์หลัก (Key Features)

- **📍 Interactive Web Map**: แสดงสถานีวัดน้ำทั่วประเทศพร้อม Marker แยกตามสถานะ (ปกติ/เฝ้าระวัง/วิกฤต)
- **🌓 Stackable Layers**: ระบบแผนที่ที่สามารถเลือกซ้อนเลเยอร์ได้หลากหลาย (ดาวเทียม, ถนน, ชื่อสถานที่, แหล่งน้ำ)
- **📈 Data Analytics**: แสดงกราฟระดับน้ำย้อนหลังและมาตรวัดข้อมูลปัจจุบันของแต่ละสถานี
- **🛡️ Admin Dashboard**: ระบบจัดการข้อมูลสถานีและผู้ใช้งานที่ทันสมัย (Modern UI)
- **🔐 User Management**: ระบบสมัครสมาชิก ล็อกอิน และการอนุมัติผู้ใช้โดยผู้ดูแลระบบ
- **⚡ Real-time Tooltip**: แสดงข้อมูลสรุปของสถานีทันทีเมื่อนำเมาส์ไปชี้ (Hover)

## 🛠️ เทคโนโลยีที่ใช้ (Tech Stack)

- **Frontend**: HTML5, Vanilla JavaScript, Bootstrap 5, Leaflet.js, Chart.js, SweetAlert2
- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL 15
- **Infrastructure**: Docker & Docker Compose

## 🚀 วิธีการติดตั้งและใช้งาน (Quick Start)

1.  **เตรียมความพร้อม**: ตรวจสอบว่าเครื่องของคุณติดตั้ง [Docker Desktop](https://www.docker.com/products/docker-desktop/) แล้ว
2.  **รันระบบ**:
    ```bash
    cd webmap
    docker-compose up -d
    ```
3.  **เข้าใช้งาน**:
    - **หน้าหลัก (แผนที่)**: [http://localhost:2025](http://localhost:2025)
    - **หน้าจัดการระบบ (Admin)**: [http://localhost:2025/admin](http://localhost:2025/admin)

> **User/Password สำหรับทดสอบ (Admin)**: 
> `admin` / `123456`

## 📁 โครงสร้างโปรเจกต์

```text
webmap/
├── server.js          # Web Server และ API Logic
├── index.html         # หน้า Dashboard แผนที่หลัก
├── admin.html         # หน้าจัดการระบบหลังบ้าน
├── login.html         # หน้าเข้าสู่ระบบ
├── init.sql           # ไฟล์โครงสร้างฐานข้อมูลเริ่มต้น
├── docker-compose.yaml # การตั้งค่า Container
└── knowledge.md       # เอกสารรายละเอียดทางเทคนิคเชิงลึก
```

## 📘 ข้อมูลเพิ่มเติม
สำหรับรายละเอียดทางเทคนิค สถาปัตยกรรมระบบ และข้อเสนอแนะในการต่อยอด สามารถอ่านเพิ่มเติมได้ที่ [webmap/knowledge.md](webmap/knowledge.md)

---
**จัดทำโดย**: Gemini CLI
