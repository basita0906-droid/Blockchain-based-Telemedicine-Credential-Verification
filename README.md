# 🩺 Blockchain-based Telemedicine Credential Verification

Welcome to a secure, decentralized solution for verifying telemedicine credentials! This project uses the Stacks blockchain and Clarity smart contracts to prevent fake doctors from practicing in underserved regions, ensuring patients get trustworthy medical advice remotely.

## ✨ Features

🔒 Secure registration of medical credentials by authorized issuers  
📜 Immutable storage of doctor qualifications and licenses  
✅ Real-time verification of doctor authenticity during telemedicine sessions  
🌍 Focus on underserved areas with geolocation-optional access controls  
💼 Patient-doctor matching based on verified specialties  
🚨 Reporting mechanism for suspicious activities  
💰 Incentive tokens for verified doctors and issuers  
📊 Audit trails for all verifications and disputes  

## 🛠 How It Works

This project involves 8 smart contracts written in Clarity to handle various aspects of credential management, verification, and telemedicine interactions. Here's a high-level overview:

### Core Smart Contracts
1. **CredentialIssuerRegistry.clar**: Manages registration of authorized credential issuers (e.g., medical boards, universities). Only approved issuers can add doctor credentials.
2. **DoctorRegistry.clar**: Handles doctor profiles, including registration with personal details and linking to issued credentials.
3. **CredentialStorage.clar**: Stores hashed versions of credentials (e.g., diplomas, licenses) with metadata like expiration dates and issuing authority.
4. **VerificationEngine.clar**: Core contract for verifying a doctor's credentials in real-time. Patients or platforms can query this to confirm authenticity before a session.
5. **AppointmentScheduler.clar**: Facilitates scheduling telemedicine appointments, ensuring only verified doctors can be booked.
6. **DisputeResolution.clar**: Allows patients to file disputes about consultations, with on-chain voting or arbitration for resolutions.
7. **IncentiveToken.clar**: A fungible token contract (using SIP-010 standard) to reward doctors for verifications and issuers for accurate credential submissions.
8. **AuditLog.clar**: Logs all key actions (registrations, verifications, disputes) for transparency and compliance audits.

**For Doctors**  
- Get certified by an authorized issuer who calls the `issue-credential` function in CredentialStorage.clar with a hash of your documents, title (e.g., "MD License"), description, and expiration.  
- Register your profile via DoctorRegistry.clar, linking to your credentials.  
- Earn incentive tokens for each successful verification.  

**For Patients**  
- Search for doctors using DoctorRegistry.clar, filtered by specialty or region.  
- Before booking, call `verify-doctor` in VerificationEngine.clar with the doctor's ID to check credentials.  
- Schedule via AppointmentScheduler.clar and leave reviews or disputes post-session.  

**For Issuers**  
- Register via CredentialIssuerRegistry.clar (requires governance approval).  
- Issue credentials securely, ensuring immutability on the blockchain.  

**For Verifiers/Platforms**  
- Integrate with VerificationEngine.clar to automate checks during app logins or calls.  
- View audit logs for compliance.  