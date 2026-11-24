# RTU Tindahan: An E-Commerce Web Platform for Food and Merchandise Trading using LLM

**Software Requirements Specification (SRS)**
**Version 1.3 — October 31, 2026**

**Proponents:** Aliermo, Neil Ryan O. · Arellano, Lian Andrew R. · Mangalino, Lorenz Ivan · Saldivar, Mark John E.

## Document Information

| Item | Detail |
| --- | --- |
| Project Title | RTU Tindahan: An E-Commerce Web Platform for Food and Merchandise Trading using LLM |
| Document | Software Requirements Specification (SRS) |
| Related Document | RTU Tindahan research paper, Chapters 1 and 2 |
| Institution | Rizal Technological University, Pasig Campus, Department of Information Technology |
| Course | System Integration and Architecture Laboratory 1, Section ICS-501A |
| Course Instructor / Adviser | Engr. Ronel D. Paglomutan |
| Prepared by | Lian Andrew R. Arellano, Project Leader / Researcher / Quality Assurance; Lorenz Ivan Mangalino, Junior Developer / Researcher; Neil Ryan O. Aliermo, Junior Developer / Researcher; Mark John E. Saldivar, Junior Developer / Researcher / Documenter |
| Version and date | 1.3, October 31, 2026 |

## Revision History

| Version | Date | Description | Author |
| --- | --- | --- | --- |
| 1.0 | October 8, 2026 | First draft, based on the survey questionnaire and the project letters. | The proponents |
| 1.1 | October 8, 2026 | Linked to the research paper. Added requirements from the literature review and a traceability appendix. | The proponents |
| 1.3 | October 31, 2026 | Updated to match prototype version 1.6. Added the Prototype status column, new requirements based on the interview of the office for Official Store tickets, stock, face-to-face entry, daily count and email preparation, and a list of items that need BAO or IT Office confirmation. | The proponents |

## Table of Contents

- [1. Introduction](#1-introduction)
  - [1.1 Purpose](#11-purpose)
  - [1.2 Scope](#12-scope)
  - [1.3 Definitions and Acronyms](#13-definitions-and-acronyms)
  - [1.4 References](#14-references)
  - [1.5 Document Overview](#15-document-overview)
  - [1.6 Relationship to the Research Paper](#16-relationship-to-the-research-paper)
  - [1.7 How to Read the Prototype Status](#17-how-to-read-the-prototype-status-new-in-12)
- [2. Overall Description](#2-overall-description)
  - [2.1 Product Perspective](#21-product-perspective)
  - [2.2 Product Functions](#22-product-functions)
  - [2.3 User Classes and Characteristics](#23-user-classes-and-characteristics)
  - [2.4 Operating Environment](#24-operating-environment)
  - [2.5 Design and Implementation Constraints](#25-design-and-implementation-constraints)
  - [2.6 Assumptions and Dependencies](#26-assumptions-and-dependencies)
- [3. Specific Requirements](#3-specific-requirements)
  - [3.1 External Interface Requirements](#31-external-interface-requirements)
  - [3.2 Functional Requirements](#32-functional-requirements)
    - [3.2.1 Accounts and Verification](#321-accounts-and-verification)
    - [3.2.2 Listings](#322-listings)
    - [3.2.3 Browse and Discovery](#323-browse-and-discovery)
    - [3.2.4 University Storefront](#324-university-storefront)
    - [3.2.5 Orders and Transaction](#325-orders-and-transaction)
    - [3.2.6 Messaging](#326-messaging)
    - [3.2.7 Ratings and Reviews](#327-ratings-and-reviews)
    - [3.2.8 Seller Dashboard](#328-seller-dashboard)
    - [3.2.9 Community Forum](#329-community-forum)
    - [3.2.10 AI Content Screening](#3210-ai-content-screening)
    - [3.2.11 Reporting and Moderation](#3211-reporting-and-moderation)
    - [3.2.12 Notification](#3212-notification)
    - [3.2.13 Administration](#3213-administration)
    - [3.2.14 Official Store Tickets](#3214-official-store-tickets-new-in-13)
    - [3.2.15 Official Store Stock](#3215-official-store-stock-new-in-13)
    - [3.2.16 Face to Face Entry, Order Sheet, and Daily Count](#3216-face-to-face-entry-order-sheet-and-daily-count-new-in-13)
    - [3.2.17 Email Preparation for the Official Store](#3217-email-preparation-for-the-official-store-new-in-13)
    - [3.2.18 Other Prototype Features](#3218-other-prototype-features-new-in-13)
  - [3.3 Non-Functional Requirements](#33-non-functional-requirements)
  - [3.4 Business Rules](#34-business-rules)
- [Appendix A. Traceability](#appendix-a-traceability)
  - A.1 Problem Statements and Hypotheses
  - A.2 Significance and User Classes
  - A.3 Design Points from the Literature
  - A.4 Research Gap (Table 1 in the Paper)
  - A.5 Survey Items
  - [A.6 Sources of the Requirements Added in Version 1.3](#a6-sources-of-the-requirements-added-in-version-13)
- [Appendix B. Items to Confirm](#appendix-b-items-to-confirm)
  - [B.1 For the BAO](#b1-for-the-bao)
  - [B.2 For the IT Office](#b2-for-the-it-office)
  - [B.3 For the University](#b3-for-the-university)
  - [B.4 For the Proponents](#b4-for-the-proponents)
- [Appendix C. Prototype Record](#appendix-c-prototype-record)
- [Appendix D. Changes from Version 1.1](#appendix-d-changes-from-version-11)

---

## 1. Introduction

This chapter presents the purpose of the specification, the scope and delimitation of the system, the terms used throughout the document, and the sources on which the specification rests. It also explains how this document relates to the capstone paper and to the prototype from which its requirements were drawn.

### 1.1 Purpose

This document sets out the requirements for RTU Tindahan, a web-based platform for food and merchandise trading at Rizal Technological University (RTU), Pasig Campus. It is intended for the researchers, the course instructor, and the office personnel who will review the system, and it states what the system must do and the limits within which it must operate. It does not describe how the system will be built. The requirements were drawn from the capstone proposal paper (Chapters 1 and 2) and from the survey, and Appendix A shows how each requirement traces back to them.

### 1.2 Scope

RTU Tindahan is designed as a web-based platform for the RTU Pasig community. It brings together three parts: an online marketplace where students, faculty, and personnel can buy and sell, an official university storefront for uniforms, books, and merchandise, and a community forum for announcements, selling schedules, and campus discussion. A large language model (LLM) is used to help check posts against university rules.

Specifically, the system covers nine areas of work: user verification through the official RTU email; listings for food, uniforms, books and school supplies, merchandise, and services; the official university storefront managed by Office Staff; order tracking, messaging between buyer and seller, and seller ratings and reviews; a seller dashboard with sales records; a community forum; listing ranking that keeps new and small sellers visible; AI screening of listings and posts with human review and appeals; and reporting, moderation, notifications, and administration tools.

The system, however, has clear delimitations. It does not process online payments, since transactions are settled in cash or through the buyer's and seller's own e-wallets at the meet-up, and the system only records order completion. It does not provide delivery or logistics services; it only records the agreed-upon pickup or meet-up arrangement. It is not a native mobile application, although the web system must work well on phone browsers. It is intended only for the RTU Pasig community, and its use should not be extended to other campuses such as BONI Campus. It does not offer personalized recommendations based on similar users, because the pilot user base is too small to support them. Finally, screening is limited to inappropriate content and does not guarantee the actual quality, safety, or legality of the items exchanged.

Prototype baseline (new in version 1.2). A working prototype, version 1.6, is already built and exists now. It was developed by using plain HTML, CSS, and JavaScript. It has no server and no database exists, just a pure prototype which saves everything in the local host browser. It shows the system would be such as the interface and basic functions that only applied on prototyping to display the marketplace, the Official RTU Store, the forum, staff tools, and the Official Store ticket and stock system. The rules that need a server are written only in the code but also run only in the browser, so someone who edits the page or the saved data can bypass them. The following are not in the prototype: the LLM screening, the appeals, email integrations and notifications, and the server side security. They stay as the requirements for the full system.

### 1.3 Definitions and Acronyms

For a clear understanding of this document, the following terms are defined according to how they are used in the specification.

| Term | Meaning |
| --- | --- |
| RTU | Rizal Technological University |
| SRS | Software Requirements Specification, this document |
| LLM | Large language model, an AI model that reads and writes text |
| AI screening | An automatic check of content against university rules before it is published |
| RA 10173 | Data Privacy Act of 2012 of the Philippines |
| Visitor | A person who has not logged in |
| Buyer / Seller | A verified user who buys or sells. One user can be both. |
| Listing | An item or service posted for sale by a seller |
| Order | A request by a buyer to get a listing or an official item, tracked by status |
| Official Store | The section where the university sells official items such as uniforms, books, and merchandise |
| Office Staff | Designated RTU personnel who manage official items and post announcements |
| BAO Staff | The office staff, who are the stakeholders and handle the Official Store. In the prototype they use the Store orders and Store inventory pages. |
| Moderator | A person who reviews flagged content, reports, and appeals |
| Administrator | A person who manages accounts, roles, categories, and screening rules |
| Hybrid ranking | A way of ordering listings that mixes popularity, recency with time decay, and content similarity |
| Cold start | The early period when a new marketplace has few users and few listings |
| Taglish | A mix of Tagalog and English in the same message |
| Pilot | The limited trial of the system with selected participants from Pasig Campus |
| Prototype | The early functional working web browser only build of RTU Tindahan, currently version 1.6 |
| Ticket | One Official Store request. It has a permanent TXN reference, a status, and a history. |
| TXN id | The permanent reference of a request, written in TXN-YYMMDD-NNN format. |
| On Hand | The units which are physically in stock for an item or size. |
| Reserved | The units held by open tickets. It is On Hand minus Available. |
| Available | Units a student can still request. It is On Hand minus Reserved. |
| Daily count | A physical count of stock that is compared with On Hand, with differences written to the inventory ledger. |
| Outbox | The list of email messages that the system has linked and prepared. In the prototype nothing in it is sent. |

### 1.4 References

This document draws on the proposal paper and on the RTU Tindahan Assessment Survey (draft questionnaire), October 2026. It also follows the Request for Permission to Conduct Survey and Administer Questionnaire dated October 5, 2026, and the Letter of Intent to the Data Privacy Unit dated October 8, 2026. The legal and technical references are the Data Privacy Act of 2012 (Republic Act No. 10173), the E-Commerce Act (Republic Act No. 8792), ISO/IEC 25010 on systems and software quality models, and IEEE Std 830-1998, which is used as a format guide. Version 1.3 also uses the prototype documents such as the README and CODE_GUIDE of version 1.6, and docs/EMAIL_INTEGRATION.md.

### 1.5 Document Overview

Section 2 describes the product itself, the possible users, and its limits. Section 3 states the specific requirements for the system, including the external interfaces, the functions, the quality needs, and the business rules that applied. Appendix A links the requirements to the current capstone paper and to the survey, while Appendix B lists down the items that still need to be confirmed by the BAO, the IT Office, or the University. Appendix C records what the prototype does and how it was tested.

### 1.6 Relationship to the Research Paper

This specification is the requirements document for the system described in the capstone proposal paper, and each part of the paper feeds a part of this document. The table below shows where each part of the paper is used here.

| Research paper | Used in this SRS |
| --- | --- |
| Chapter 1: Statement of the Problem and Hypothesis | Section 3.2 and Appendix A.1 |
| Chapter 1: Significance of the Study | Section 2.3 and Appendix A.2 |
| Chapter 1: Scope and Limitation | Sections 1.2, 2.5, and 3.4 |
| Chapter 2: Sections 2.1 to 2.9 (literature and related studies) | Sections 3.2 and 3.3, and Appendix A.3 |
| Chapter 2: Synthesis and Research Gap (Table 1) | Appendix A.4 |

### 1.7 How to Read the Prototype Status (new in 1.2)

Every requirement in section 3.2 has a Prototype status.

| Status | Meaning |
| --- | --- |
| Built | It works in the prototype version 1.6. |
| Partly | Some of it works. The note says what is missing. |
| Not yet | It is not in the prototype. Most of these need a server or an outside service. |

The status describes only the prototype. It does not lower the requirement for the full system.

The Prototype status and Note columns are new in this version.

## 2. Overall Description

RTU Tindahan showcases buying, selling, official school items, and announcements into one specific verified place. The prototype shows this in the browser, and the full system adds a server, real email, and AI screening.

### 2.1 Product Perspective

RTU Tindahan is a new and standalone system. Buying and selling among students is a regular part of campus life at RTU Pasig, and it now takes place almost entirely through Facebook groups and Messenger chats. This mirrors a wider shift in which social media has transferred market power to ordinary users, who can list items and transact with peers without a dedicated commercial platform. These channels, however, were never designed for commerce. Listings are unstructured, get buried within hours, and cannot be searched or filtered, which makes the products hard to find and small sellers hard to notice. There is no way to confirm that the other person on the other end is a campus member, and there is no record of the orders that were agreed upon. The university, for its part, has no online storefront or announcement channel for its own commercial functions.

RTU Tindahan responds to these conditions by bringing buying, selling, official school items, and announcements into one verified place. It launches together with the Official Store and the forum, so the site is useful even before student listings grow. The system works with two outside services: the email service used to send verification and notification emails, and the LLM service used for AI screening.

In version 1.3, the Official Store is described from the point of view of the office that runs it. Every online request has a ticket with a permanent reference, a status, and a history. Office staff inventory the stock of every item and size from reservation or from on hand available stock, and the ledger shows every change to it. The prototype keeps this inside the browser, so it demonstrates the flow but is not a production tool.

### 2.2 Product Functions

Specifically, the system performs twelve main functions. It creates and verifies accounts through the RTU email and allows sellers to create, edit, and manage their listings. It enables users to search and browse listings and to order official items from the university storefront. It supports the placing and tracking of orders, with a saved record of each order, as well as messaging between buyer and seller. It further provides ratings and reviews for sellers, a seller dashboard with sales records, and a community forum for announcements and selling schedules. Behind these functions, the system carries out AI screening with human review and appeals, reporting and moderation, and notifications and administration. Version 1.3 adds the four Official Store functions, the ticket handling with status history (3.2.14), stock control with a ledger, low stock warnings, ordering windows, and limits (3.2.15), face to face entry, a compiled order sheet, and the daily count (3.2.16), and the preparation of notification emails (3.2.17). It also records other prototype features, such as favorites, profile pictures, and the staff Users and audit page (3.2.18).

### 2.3 User Classes and Characteristics

Five classes of users are expected to interact with the system. The table below describes each class and the access it needs.

| User Class | Description | Main Access | Prototype |
| --- | --- | --- | --- |
| Visitor | A person who has not logged in. | Landing page, marketplace preview, registration, and log-in. | Landing page, and guest pages for Books and RTU Merchandise (up to 4 listings each, seller names hidden). |
| Verified User (Buyer / Seller) | An RTU Pasig student, faculty member, or non-teaching personnel with a verified RTU email. | Browse, post listings, order, message, review, report, and use the forum. | Students with an RTU student-number email (0000- 000000@rtu.edu.ph). |
| Office Staff | Designated office personnel who handle official items and announcements. | Manage the Official Store and post announcements. | One built-in staff account (admin@rtu.edu.ph) that also acts as Moderator and Administrator. It uses Store orders and Store inventory. |
| Moderator | A person who reviews flagged content, reports, and appeals. | Moderator queue and moderation actions. | Same staff account: Listing approval, Forum Reports, and Users and audit. |
| Administrator | A person who manages the system. | Accounts, roles, categories, screening rules, and audit logs. | Same staff account. Roles cannot be changed from the screen on purpose. |

### 2.4 Operating Environment

The system is intended to run in a web browser. Users are expected to access it from smartphones, laptops, tablets, and desktop computers with an internet connection. The server, database, and hosting will be chosen during the design stage.

The prototype is a folder of plain files. It runs by opening index.html or through a local server such as VS Code Live Server or runs on a local host. It needs internet once to load the Inter font. All data stays in the browser that created it, so two computers do not share data.

### 2.5 Design and Implementation Constraints

The design of the system is bound by several constraints. First, it must follow the Data Privacy Act of 2012 (RA 10173) and recognize electronic transactions under the E-Commerce Act (RA 8792). Second, only verified members of the RTU Pasig community may use the marketplace and the forum, and the system must not process payments or provide delivery. Third, AI decisions on uncertain content must be reviewed by a person, users must be able to appeal, and personal data must be removed from content before it is sent to the LLM service. Because screening checks for inappropriate content only, it does not guarantee quality, safety, or legality. In addition, the system must launch together with the Official Store and the forum so that it has content before student listings grow, and it must work well on phone browsers. Lastly, as an academic project, it is limited to RTU Pasig Campus and must be completed within the project duration.

Version 1.3 adds four constraints from the prototype work: Any status name, transition rule, stock rule, limit, window, or wording that depends on a BAO policy shall be editable by its staff or marked as waiting for the confirmation. It shall not be fixed in code as if it were policy. Email credentials and keys shall never be placed in front end code. Sending shall happen only from a server. Changes from the Official Store shall keep the existing student marketplace, accounts, transactions, products, and TXN references. Saved data shall be upgraded safely when it loads, and nothing shall be deleted by an upgrade.

### 2.6 Assumptions and Dependencies

The Project operates under several key assumptions and operational guidelines; users possess and can receive messages through official RTU emails, with the University defining qualifying addresses. Office staff will supply the necessary lists and details for official university items, while an accessible LLM service will support system functions alongside documented University screening rules. Initially, the platform will be developed as a project for a school subject requirement and as a pilot test involving selected participants from Pasig campus, with the flexibility for survey results to adjust the priority of specific requirements as needed.

Version 1.3 adds these assumptions. The BAO will confirm the Official Store statuses, including the cancellation rules, its stock definitions, the item types, ordering windows, the limits, and claim notes (Appendix B). The IT Office will decide the mail service, sender, server, and security setup before any email is sent. The prototype's Official Store values are proposals for testing and are not BAO policy.

## 3. Specific Requirements

### 3.1 External Interface Requirements

#### 3.1.1 User Interfaces

The interface shall be responsive and shall follow the RTU Tindahan look, including its logo and colors, with a light theme and a dark theme. The main screens are the Home, Marketplace, Official Store, Forum, Listing Details, Profile, Messages, Orders, Seller Dashboard, Moderator Queue, and Admin Panel. The prototype has these screens.

| Group | Screens |
| --- | --- |
| Everyone | Landing page (About Us, Insights, Need Help?), guest pages, Sign in, Create account in 3 steps |
| Signed in users | Marketplace, Browse All, Student Sellers, Official RTU Store, product page, cart, Sell an item, My Shop (Overview, Orders and Requests, My Listings, Ratings and Reviews), Favorites, My Orders, Messages, Forum and post page, Notifications, My profile |
| Staff | Listing approval, Transactions, Forum Reports, Users and audit, Staff tools, Store orders, Store inventory |

The Moderator Queue and Admin Panel of version 1.1 are covered in the prototype by the staff screens above.

#### 3.1.2 Hardware Interfaces

The system has no special hardware needs. Users only need a device with a web browser, and sellers may use a camera or a file upload to add photos.

#### 3.1.3 Software Interfaces

The system relies on three software interfaces. The email service sends verification, password reset, and notification emails. The LLM service receives content for screening and returns an outcome and a reason. The database stores accounts, listings, orders, messages, reviews, posts, reports, and logs.

In the prototype, the database is on the browser's local storage (key rtu_db_v2 , photos under rtu_img_v1). The sign-up code is sent through EmailJS only if the team enters its keys in js/0-config.js. Without them the prototype runs in demo mode and shows the code on screen. There is no LLM service. The notification emails of the Official Store are prepared in an outbox and are never sent.

#### 3.1.4 Communications Interfaces

The browser and the server shall communicate over HTTPS, and calls to outside services shall likewise use secure connections. The prototype has no server, so this applies to the full system.

### 3.2 Functional Requirements

Each functional requirement is assigned a unique identifier and an initial implementation priority, and since version 1.2, a prototype status (see 1.7). Requirements marked as "changed in 1.2" have new wording. Two duplicate identifiers in version 1.1 are corrected, the BD-08 is now BD-09, and the second ST-05 is now ST-06.

#### 3.2.1 Accounts and Verification

| ID | Requirement | Priority | Prototype Status | Note |
| --- | --- | --- | --- | --- |
| AV-01 | The system shall allow a prospective user to register an account using an official RTU email address. | High | Built | The email must be the student-number format, which is 0000- 000000@rtu.edu.ph. |
| AV-02 | The system shall reject any registration attempt that utilizes a non-institutional or unauthorized email domain. | High | Built | |
| AV-03 | The system shall send a unique verification link to the registered RTU email address to activate the account only upon confirmation of that link. | High | Partly | Changed in 1.2, a 6-digit code verification is used. It will expire on a 5 minute duration and only allows 5 tries, the new one can be asked every 30 seconds. Real sending needs EmailJS keys. Without them the code shows on screen (demo mode). |
| AV-04 | The system shall record whether the user is a student, faculty member, or non-teaching personnel, the user's campus, and the user's college, institute, or office. For students, it shall also record the year level. Only Pasig Campus users shall be accepted. | High | Partly | The prototype only records the name, program, and affiliation. Year level and campus are not recorded. |
| AV-05 | The system shall show a verification badge on the profile and listings of every verified user. The badge means that the account's RTU email and Pasig Campus membership were checked. It does not mean the university endorses the seller or the items. | High | Built | A small check badge sits on the avatar, with a tooltip. |
| AV-06 | The system shall enable verified users to log in, log out, and initiate password recovery via their registered RTU email address. | High | Partly | The pop up for Sign in, sign out, and a Reset your password exists. The reset only runs in the browser and sends no email. |
| AV-07 | The system shall let a user edit the profile: display name, profile photo, course and year information, and an optional contact number. | Medium | Partly | It has an Edit Profile pop-up with profile picture upload, preview, replace, and removal. The contact number is not available in the prototype. |
| AV-08 | The system shall allow any verified account holder to operate seamlessly as both a buyer and a seller. | High | Built | |
| AV-09 | The system shall allow only one account for each RTU email address, and shall not let a suspended user register again with the same email. | High | Built | A suspended or banned account keeps its email. |
| AV-10 | The system shall give each account one state. Only Active accounts can log in, buy, sell, message, or post. | High | Partly | Changed in 1.2, states the Active, Suspended, and Banned. An account is created only after the verification code is confirmed, so pending verification is not a stored state. Deactivated is not available in the prototype. |
| AV-11 | The system shall show visitors only the landing page, registration, login, and the preview of RTU merchandise. Everything else shall need a log-in. | High | Built | Changed in 1.2, guest pages show up to 4 listings each with the seller names are completely hidden. Other pages show a Sign in to continue pop-up. |

#### 3.2.2 Listings

| ID | Requirement | Priority | PrototypeStatus | Note |
| --- | --- | --- | --- | --- |
| LS-01 | The system shall let a seller create a listing with a title, description, category, price, photos, and a preferred campus meet-up place. For items, it shall also take the condition (new or used) and the quantity available. Services have no condition or quantity. | High | Built | Sell an item first asking for a Physical Product or Service. Sellers may also pick a time window (7:00 AM to 7:00 PM) and the days for their own preference. Products can have up to two variation options. |
| LS-02 | The system shall provide these categories: Books and Academic Materials, School Supplies, RTU Merchandise, Clothing and Accessories, Knickknacks and Collectibles, Electronics and Gadgets, Food and Snacks, Other Items, and Services. | High | Built | Changed in 1.2: replaces the category list of version 1.1. which are Official items that use the same categories. Clothing and Accessories has a Uniform type, and Books has Textbook, Manual, and even Reviewer or notes. |
| LS-03 | The system shall let a seller list services such as printing, tutoring, and repairs using the same listing form. | Medium | Built | Services are classified by type, rate, and billing structure. |
| LS-04 | The system shall let a seller edit, mark as sold or unavailable, and delete their own listings. Delete shall hide the listing from all users and keep it in the order records. A listing with an open order (Pending, Accepted, or Ready for Meet-up) cannot be deleted. | High | Partly | To Edit, pause, resume, and remove are available in My Shop. A rule that blocks deleting a listing with an open order is not confirmed. |
| LS-05 | The system shall hold every new listing, and every edit to the title, description, photos, category, or meet-up place, for review before it is published. Changes to the price or the quantity shall be published at once. | High | Partly | Changed in 1.2, the prototype uses staff approval (Listing approval page) in place of AI screening. Staff approve or reject with a note. |
| LS-06 | The system shall show the seller name, verification badge, and rating on each listing. | High | Built | |

#### 3.2.3 Browse and Discovery

| ID | Requirement | Priority | Prototype Status | Note |
| --- | --- | --- | --- | --- |
| BD-01 | The system shall allow users to search marketplace listings using text keywords. | High | Built | |
| BD-02 | The system shall let a user filter listings by category and by price range (a minimum and a maximum). | High | Partly | A category and a maximum price filtering are included, but minimum price is not. |
| BD-03 | The system shall show sections for best-selling, most popular, and newest listings, as defined in 1.3. | Medium | Partly | Latest Items and Best Selling Items filtering are included. Best Sellers count completed sales only, whereas the most popular section does not. |
| BD-04 | The system shall show a section that features listings from small sellers (see 1.3) so they can be discovered. This section is separate from the Newest Listings section in BD-08. | Medium | Not yet | |
| BD-05 | The system shall restrict search results and discovery feeds exclusively to approved, currently published listings. | High | Built | Listings that are pending, rejected, paused, or removed by staff are not displayed. |
| BD-06 | The system shall allow users to sort listing results chronologically by newest submission or numerically by price. | Low | Built | Browse All also filters the Best Selling, Least Sold, Top Rated, and Lowest Rated. |
| BD-07 | The system shall order the default browse feed with a hybrid score that combines popularity and recency with time decay. When the user types a search, the score shall also use how closely the listing text matches the search words. The system shall not use the user's own history to order listings. | Medium | Partly | Browse has a Recommended sort. The hybrid score using time decay and text matching is not yet confirmed for the prototype. |
| BD-08 | The system shall keep a Newest Listings section that is not affected by popularity, so first-time sellers stay visible. | Medium | Built | Latest Items are shown on the newest published first. |
| BD-08 | The system shall not show listings that are marked sold or unavailable, or that have no quantity left, in search results or sections. They shall stay in the order records. | Medium | Partly | A sold out item has a tag that shows Sold Out and cannot be reserved. The order records are kept. |

#### 3.2.4 University Storefront

| ID | Requirement | Priority | PrototypeStatus | Note |
| --- | --- | --- | --- | --- |
| ST-01 | The system shall let Office Staff add, edit, and remove official items (uniforms, books and modules, and school merchandise) with price and stock count. | High | Built | It has staff tools for the office staff. A new official item was announced in the forum. Removing an item while having an open ticket is blocked. The stock of an existing item is changed in store inventory not by the edit form. |
| ST-02 | The system shall show official items in a separate Official Store section with a clear Official label. | High | Built | The system interface features a dark-themed official RTU badge prominently displayed on the product cards and dedicated product pages. |
| ST-03 | The system shall let a verified user order official items online. The order is a reservation. Payment and claiming happen at the university office, outside the system. | High | Built | Changed in 1.2. Stock is reserved when the request is made, released when the ticket is cancelled, and issued when the ticket is claimed. |
| ST-04 | The system shall hold the requested stock count when an official request is made, release if the ticket is cancelled, take it out of stock when the ticket is claimed by Office Staff and confirm the official order, and shall mark the item out of stock when the count reaches zero. An item that has no available units shall be marked as out of stock. | Medium | Built | Changed in 1.2. Stock is reserved when the request is made, released when the ticket is cancelled, and issued when the ticket is claimed. |
| ST-05 | The system shall track each official order with these statuses: Request Received, Confirmed, On Hold, Ready for Pickup, Claimed, and Cancelled. Office Staff shall update the status. The date and time of each change shall be recorded, and the buyer shall see the current status. | High | Built | Changed in 1.3. It used Pending, Confirmed, Ready for Claiming, Completed, and Cancelled functions. The new names are proposals that the BAO must verify. |
| ST-05 | The system shall let a buyer cancel an official order only from the statuses that staff allow. | Medium | Built | Changed in 1.2. Default only allows it while only the status is Request Received. The staff can change that in store orders, settings. |

#### 3.2.5 Orders and Transaction

This section covers student to student orders. Official Store orders are on 3.2.14.

| ID | Requirement | Priority | Prototype Status | Note |
| --- | --- | --- | --- | --- |
| OT-01 | The system shall allow a buyer to submit an order request for a marketplace listing, specifying the desired quantity and an optional transaction note. | High | Built | The items are saved at the time of its request, including the variation and price chosen. |
| OT-02 | The system shall allow the corresponding seller to formally accept or decline an incoming order request. | High | Built | An individual chat can be open directly within the requests. |
| OT-03 | The system shall track each order with these statuses: Pending, Accepted, Ready for Meet-up, Completed, Declined, and Cancelled. A Pending order can become Accepted, Declined, or Cancelled. An Accepted order can become Ready for Meet-up or Cancelled. A Ready for Meet-up order can become Completed or Cancelled. Both buyer and seller shall see the current status. | High | Partly | The prototype displays distinct transactions based on user roles. For users, the interface shall see the following states, the Awaiting Seller, Meetup Set, Completed, and Cancelled. For the transactions, the system shall track and display the Pending, Confirmed, Completed, and Cancelled. The declined order was recorded as Cancelled. Ready for Meet up is not a separate status. |
| OT-04 | The system shall record an exact timestamp for every status transition within an order's lifecycle. | High | Built | Each of every transaction has a record and keeps its status history. |
| OT-05 | The system shall keep a record of each order (item, price, quantity, notes, and status history) even if the related chat messages, the listing, or an account are deleted. | High | Partly | The records stay even if there's a change on listing or removed. Account deletion is not in the prototype. |
| OT-06 | The system shall let the buyer and seller choose how payment will be made: cash at a campus meet-up or an e-wallet arranged with the seller. The system shall only record this choice and shall not process payments. | High | Not yet | The pages say there is no online payment and that payment has to be done during face to face transactions. The prototype does not record a payment choice. |
| OT-07 | The system shall show a user's contact number, if the user entered one, to the other party only while the order is Accepted or Ready for Meet-up, and shall hide it once the order is Completed, Declined, or Cancelled. | High | Not yet | The contact number field is absent from the prototype. |
| OT-08 | The system shall permit either the buyer or the seller to cancel an active order prior to its final completion. | Medium | Partly | A buyer can cancel its order and a seller can decline the request order. Seller cancel after accepting is not confirmed. |
| OT-09 | The system shall record the mutually agreed campus meet-up location and scheduled time for every transaction. | High | Built | It is shown in Transactions and in the CSV export. |
| OT-10 | The system shall mark an order Completed only after both the buyer and the seller confirm that the meet-up took place. | High | Partly | The Completed is the set when the order has been picked up and is confirmed. Two sided confirmation is not confirmed in the prototype. |
| OT-11 | The system shall hold the ordered quantity when the seller accepts an order, and shall not let a seller accept more than the quantity available. The held quantity shall be returned if the order is Declined or Cancelled, and removed for good when the order is Completed. | High | Partly | The system shall withdraw inventory stock from the selected item variation upon the order placement and automatically restore it to the corresponding variation when the order is cancelled or declined. |
| OT-12 | The system shall cancel a Pending order that the seller has not answered within a set time, and shall tell the buyer and the seller. | Medium | Not yet | The older automatic timer was removed. |

#### 3.2.6 Messaging

| ID | Requirement | Priority | PrototypeStatus | Note |
| --- | --- | --- | --- | --- |
| MS-01 | The system shall allow a buyer and seller to exchange direct text messages linked to a specific marketplace listing or active order. | High | Built | The messaging system shall be done by a pair of people. Every message must support an optional chip referencing the specific product, service, or order associated along with the discussion of . |
| MS-02 | The system shall provide users with a consolidated conversation inbox featuring visual indicators for unread messages. | Medium | Built | |
| MS-03 | The system shall allow messaging only between verified users. | High | Built | Only the two people involved in a chat can open it. The communication via chats with the Official Store are shared by staff. |
| MS-04 | The system shall allow a participant to formally report a conversation thread for policy violations (refer to Section 3.2.11). | Medium | Not yet | Reports exist for the posts on forum and the comments on there only. |
| MS-05 | The system shall let a moderator see only the messages in a conversation that has been reported. | High | Not yet | |

#### 3.2.7 Ratings and Reviews

| ID | Requirement | Priority | Prototype Status | Note |
| --- | --- | --- | --- | --- |
| RR-01 | The system shall let a buyer rate a seller from 1 to 5 stars and write a review after an order is completed. | High | Built | The buyer can rate the item in the order. |
| RR-02 | The system shall allow only one review per completed order. | High | Built | Only one rating per order. |
| RR-03 | The system shall show on each seller profile the average rating, the number of reviews, and the number of completed transactions. | High | Partly | The average and count are shown in the sellers profile. An item without a rating will say no ratings yet. |
| RR-04 | The system shall hold review text for AI screening before it is published. | Medium | Not yet | Review will be published once. The staff can remove one. |
| RR-05 | The system shall not let a seller edit or delete a review. A seller may report a review. | Medium | Partly | Only the author can alter the review and only staff can remove it. Reporting it was not in the prototype. |
| RR-06 | The system shall let a buyer edit or delete their own review. An edited review shall be screened again before the change is published. | Medium | Partly | The edit and delete are deployed with it, and edited reviews are marked edited. Screening again is not. |
| RR-07 | The system shall count only published reviews in the average and the number of reviews. Reviews that are waiting, rejected, or removed shall not count. | High | Built | |
| RR-08 | The system shall not ask for reviews on official orders, because the Official Store has no seller account. | Medium | Partly | Official tickets have their own format and flow that are detailed in 3.2.14 and do not include a review step. |

#### 3.2.8 Seller Dashboard

| ID | Requirement | Priority | Prototype Status | Note |
| --- | --- | --- | --- | --- |
| SD-01 | The system shall give each seller a dashboard that lists the orders received and the sales records. | High | Built | The My Shop includes for tabs: Overview, Orders and Request, My Listing and the Ratings and Review. |
| SD-02 | The system shall show on the dashboard the total number of completed sales, the number of orders by status, and the total sales amount for a chosen period. The sales amount shall count completed orders only. | Medium | Partly | The Overview shows the shop figures and the overall shop ratings from the real order and reviews. The chosen period is not applicable on the prototype. |
| SD-03 | The system shall allow sellers to filter their historical sales records by date range and order status. | Medium | Not yet | Only the staff has the permission to filter the transactions by status, type, and date. |
| SD-04 | The system shall allow sellers to export and download their sales records as a structured file. | Low | Not yet | Staff can export the transactions as CSV files but the sellers cannot. |

#### 3.2.9 Community Forum

| ID | Requirement | Priority | Prototype Status | Note |
| --- | --- | --- | --- | --- |
| CF-01 | The system shall provide a community forum with these categories: Announcements, Selling Schedules, and General Discussion. | High | Partly | The forum has tabs for All posts, Discussions, New listings, and Notices, with Latest and Popular order by. New listings are automatically posted when it is approved. |
| CF-02 | The system shall allow verified users to publish discussion posts and comments within permitted forum categories. | High | Built | Posts can have a title and upload up to 4 photos. Comments can be nested. One reaction for each account per post. |
| CF-03 | The system shall restrict posting privileges within the Announcements category exclusively to designated Office Staff and Administrators. | High | | The staff users must be granted permissions to create, manage, and remove announcements within the designated administrative dashboard. |
| CF-04 | The system shall pin official announcements to the top of the forum interface for prominent visibility. | Medium | | Staff can pin. The pinned posts stay on top. |
| CF-05 | The system shall require users creating Selling Schedule posts to specify a valid date, time, and campus location. | Medium | | Listings carry a meet up place, time window, and days. A scheduled post type of function is not in the prototype. |
| CF-06 | The system shall hold all newly submitted forum posts and comments for automated AI screening prior to public display. | High | | Posts and comments are shown at once. Users can report them and staff moderate it. |
| CF-07 | The system shall let the author edit or delete their own posts and comments. An edited post or comment shall be screened again before the change is published. | Medium | | Authors edit and delete after a confirmation. A deleted comment with replies shows as [deleted]. Screening again is not in the prototype. |

#### 3.2.10 AI Content Screening

The prototype has no LLM. Instead it uses a human review: staff approve or reject listings (Listing approval) and staff review reports (Forum Reports). Every requirement said in this section is therefore Not yet, except where a note says otherwise. This section stays as the target for the full system.

| ID | Requirement | Priority | Prototype Status | Note |
| --- | --- | --- | --- | --- |
| AI-01 | The system shall use an LLM to check the text of each new listing, each edited listing (as set in LS-05), and each new or edited forum post, comment, and review against the university rules before it is published. | High | Not yet | |
| AI-02 | The system shall classify each screened submission into one of three distinct outcomes: Approved, Needs Review, or Rejected. | High | Not yet | |
| AI-03 | The system shall automatically publish submissions that receive an Approved classification. | High | Not yet | |
| AI-04 | The system shall hold content marked Needs Review and place it in the moderator queue. A human moderator shall make the final decision. | High | Partly | Staff review is built for listings (Listing approval). |
| AI-05 | The system shall block the publication of submissions classified as Rejected and present the submitting user with the specific reason for rejection. | High | Partly | Staff reject a listing alongside with a note, and the seller is told. |
| AI-06 | The system shall let a user appeal a Rejected decision after a moderator has confirmed it (AI-11). A different moderator, or an Administrator, shall review the appeal and send the final decision with a reason. The moderator who confirmed the rejection shall not review the appeal. | High | Not yet | |
| AI-07 | The system shall send content to the moderator queue, and not publish it, if the LLM service is unavailable or returns an error. | High | Not yet | |
| AI-08 | The system shall keep a log of every screening: the content ID, the cleaned text that was sent to the LLM, the outcome, the reason, the confidence level, and the time. | High | Not yet | |
| AI-09 | The system shall send to the LLM service only the content being checked, and only after removing names, contact numbers, and other identifying details from it. | High | Not yet | |
| AI-10 | The system shall let an Administrator update the screening rules without changing the program code. | Medium | Not yet | |
| AI-11 | The system shall place every Rejected item in the moderator queue so a moderator can confirm or reverse the rejection. A reversed rejection shall be published. The AI result is never the final authority. | High | Not yet | |
| AI-12 | The system shall have the LLM give a confidence level with each outcome, and shall treat a low confidence result as Needs Review. | High | Not yet | |
| AI-13 | The system shall tell users in plain language, at registration and on the posting screens, that content is screened automatically and how to appeal a decision. | High | Not yet | The prototype has its Community guidelines and prohibited items policy pop ups. |
| AI-14 | The system shall screen content written in English, Filipino, or a mix of both (Taglish). | High | Not yet | |
| AI-15 | The system shall store, for each screened item, the AI outcome and the moderator's final decision, so accuracy, precision, and recall can be measured. | Medium | Not yet | |
| AI-16 | The system shall show a notice that screening checks only for inappropriate content and does not guarantee the quality, safety, or legality of items. | Medium | Not yet | |

#### 3.2.11 Reporting and Moderation

| ID | Requirement | Priority | Prototype Status | Note |
| --- | --- | --- | --- | --- |
| RM-01 | The system shall let a user report a listing, user, post, comment, review, or conversation and choose a reason: Misleading, Scam, Inappropriate, Not from RTU, or Other. | High | Partly | Posts and comments can be reported with a certain reason. You cannot report your own content or the same item twice. A copy of the text is saved along with the report. |
| RM-02 | The system shall place each report in the moderator queue with a status: Received, Under Review, or Resolved. | High | | The forum reports shows Open, Reviewed, Dismissed, and Action taken, with a distinct tab each. |
| RM-03 | The system shall let a moderator remove content, warn a user, or dismiss a report. A moderator may also recommend that a user be suspended. An Administrator shall carry out the suspension (AD-01). | High | | The staff can hide, restore, delete, warn, or dismiss a content. Only one account for all staff since it does all roles, so no separate recommendation step exists. |
| RM-04 | The system shall let the person who made a report see its status: Received, Under Review, or Resolved. A Resolved report shall show whether action was taken or the report was dismissed. | Medium | | |
| RM-05 | The system shall record a comprehensive audit log entry for every moderation action executed on the platform. | High | | A moderation log sits under forum reports, and the Audit log tab records who did what, to what, when, and the note of it. An entry cannot be edited or deleted from the screen. |
| RM-06 | The system shall show a moderator the past reports and actions linked to a user when the moderator reviews a report. | Medium | | |
| RM-07 | The system shall strictly conceal the identity of the reporting user from the individual who was reported. | High | | The reporter of the content is listed only on the staff forum reports page. |
| RM-08 | The system shall let a user appeal a moderator's removal, warning, or suspension. An Administrator who did not make the original decision shall review the appeal and send the final decision with a reason. | Medium | | |

#### 3.2.12 Notification

| ID | Requirement | Priority | Prototype Status | Note |
| --- | --- | --- | --- | --- |
| NT-01 | The system shall send in-app notifications for new orders, order status changes, new messages, screening outcomes, appeal decisions, report status changes, and warnings, removals, or suspensions by a moderator. | Medium | Partly | Each notification opens what it is about such as an order, a listing, a post, a conversation, or the approval page. Screening, appeal, and report status notices are not in the prototype. |
| NT-02 | The system shall send emails for account verification and password reset. Official store ticket updates and low stock warning shall also be sent by email once the IT office approves the email integration setup (3.2.17). No other notice shall be sent by email. | High | Partly | Changed in 1.2. Only the sign up code and verification code can be emailed, through EmailJS. Official Store emails are prepared and never sent. |

#### 3.2.13 Administration

| ID | Requirement | Priority | Prototype Status | Note |
| --- | --- | --- | --- | --- |
| AD-01 | The system shall let an Administrator activate, suspend, and reactivate accounts, including carrying out a suspension that a moderator recommended. | High | Built | Account Moderation: Admins can suspend, ban, or restore users with a credible reason for logging. Hard system restrictions prevent the suspension or banning of staff accounts and users accounts. |
| AD-02 | The system shall allow an Administrator to assign and revoke Office Staff and Moderator role privileges. | High | Not yet | It is left out on purpose. It has one built in account for the staff that has all roles appropriate for them. |
| AD-03 | The system shall allow an Administrator to create, edit, and manage marketplace categories and AI screening policy rules. | Medium | Partly | The marketplace categories are already fixed in code. Staff can alter the Official Store item types in store inventory. |
| AD-04 | The system shall let an Administrator view the audit logs. The audit log shall record role changes, account state changes, screening rule changes, and moderator actions. | Medium | Partly | The account state changes and moderator actions are all recorded, and so are Official Store actions. There are no role changes or screening rules to record in the prototype. |
| AD-05 | The system shall have a first Administrator account created by the project team when the system is set up, and shall let an Administrator give the Administrator role to another verified user. | Medium | Partly | A built in staff account exists. Handing the role to another user is not in the prototype. |

#### 3.2.14 Official Store Tickets (new in 1.3)

These requirements have come from the interviews with the BAO which will be the official store office. All names, transitions, and rules marked Proposed are starting values for testing. Staff can edit them in Store orders, Settings, and the BAO must verify them (Appendix B).

| ID | Requirement | Priority | Prototype Status | Note |
| --- | --- | --- | --- | --- |
| OS-01 | The system must turn every Official Store request into a ticket with a permanent reference using the form TXN-YYMMDD-NNN. The reference cannot ever change. | High | Built | All older official requests remain their TXN id even when the data is upgraded. |
| OS-02 | Each of the tickets shall have a status, a source whether online or in person, an optional queue number, an optional pickup date, an optional staff note, and a status history. Each history line must hold the old status, the new status, who made the change, when, and the note. | High | Built | |
| OS-03 | The system must implement these statuses: Request Received, Confirmed, On Hold, Ready for Pickup, Claimed, and Cancelled. Changes in status shall be allowed only along the transitions in the table below. | High | Built | Proposed. The staff can edit the transitions. |
| OS-04 | The system shall ask for a reason when a ticket is put On Hold or Cancelled, and shall save the reason in the history. | High | Built | Proposed. Staff can edit which statuses need a reason. |
| OS-05 | The system shall let only staff change a ticket status. Every change shall be written to the ticket history and to the audit log, and the student shall get an in-app notification. | High | Built | Staff only check runs on the browser only. |
| OS-06 | The system is obliged to show the student a progress bar (Request Received, Confirmed, Ready for Pickup, Claimed), a marker for On Hold or Cancelled, the pickup date if the order is set, and the claim notes. | High | Built | In My Orders. |
| OS-07 | The system must let users see and cancel only their own tickets, and from the statuses that staff allows only (see ST-06). | Medium | Built | Proposed. The default: Request Received only. |
| OS-08 | The system shall be able to provide each ticket with a daily queue number. The queue number must be switched off until the BAO chooses to employ it, and its prefix, number of digits, and daily reset shall be set. It must be separate from the TXN reference. | Medium | Built | The format of queue number is not assumed. |
| OS-09 | The system must give staff a Store orders page with a ticket list that can be browsed and filtered by its status, source, item, request date, and pickup date, an overview with counts, a ticket detail with its history, and a print view with a CSV export. | High | Built | It shows how many tickets are waiting on the badge at the sidebar. |
| OS-10 | The system must show the claim notes on each ticket. A store-wide note and a note for each item shall be settings that staff can edit. It must be empty until the BAO supplies the wording. | High | Built | |
| OS-11 | The system must upgrade older official requests to tickets without deleting or renaming anything. Pending becomes Request Received, Confirmed stays Confirmed, Completed becomes Claimed, and Cancelled stays Cancelled. | High | Built | The fields for older status are kept in step, so older screens and exports still work. |
| OS-12 | The system shall let staff edit the allowed transitions, statuses that need a reason, statuses from which a user can cancel, the queue number settings, and the store wide claim note. | Medium | Built | Store orders, Settings. |

Default transitions (Proposed):

| From | Allowed next statuses |
| --- | --- |
| Request Received | Confirmed, On Hold, Cancelled |
| Confirmed | Ready for Pickup, On Hold, Cancelled |
| On Hold | Confirmed, Ready for Pickup, Cancelled |
| Ready for Pickup | Claimed, On Hold, Cancelled |
| Claimed | None |
| Cancelled | None |

#### 3.2.15 Official Store Stock (new in 1.3)

| ID | Requirement | Priority | Prototype Status | Note |
| --- | --- | --- | --- | --- |
| IV-01 | The system ought to track On Hand, Reserved, and Available units for every official item and every size. Available = On Hand − Reserved. | High | Built | Reserved is calculated, not stored. Proposed definitions. |
| IV-02 | The system shall maintain a stock ledger that has a record of every inventory adjustment as an individual line item. Each record must capture the following information: adjustment type, item, size, quantity, change in 'On Hand' stock, change in 'Reserved' stock, resulting balance, associated ticket, reason, user who performed the action, and timestamp. | High | Built | |
| IV-03 | The ledger types and their effects shall be as in the table below. | High | Built | Proposed. Issued and Sold need BAO confirmation. |
| IV-04 | The system shall alter the stock only by the ledger. A change must be refused if it would make any count as negative, request with several lines shall be applied fully or not at all. | High | Built | The item edit form shows the stock as read only. |
| IV-05 | The system shall let only the staff add stock (Stock In) or correct it (Adjustment). An adjustment must need a reason. | High | Built | |
| IV-06 | The system shall hold the stock for a new request (Reserved), return it when the ticket is cancelled (Released), and take it out when the ticket is already claimed (Issued). | High | Built | The staff cancel and students cancel both releases. A duplicate claim cannot issue twice |
| IV-07 | The system shall let staff edit the item types (default: Sablay, Book, Uniform, Merchandise, Other) and must show them as tabs in the Official Store. Each type shall have a mapping to an existing category. | Medium | Built | Proposed. The mapping of Sablay is for the BAO to confirm. |
| IV-08 | The system shall let staff set a low stock level for each item and each size. When Available reaches that level, the system must warn the staff once in the app and prepare a low stock email (EM-04). | High | Built | The warning connects to Store inventory. |
| IV-09 | The system must let staff set an ordering window (start, end, and a message) which will serve for the whole store and for each item. Outside the window, students must not have access to add items or send requests, and shall see the message. | Medium | Built | Off by default. |
| IV-10 | The system shall let staff set a limit per student for the whole store and for each item. A limit of 0 means no limit. Tickets that are not cancelled, including claimed ones, shall be counted toward the limit. | Medium | Built | Proposed scope and period. A student is identified by student number or email only. |
| IV-11 | The system must let staff run a check that replays the ledger and compares it with the stock and the open tickets, and must report any anomalies. | Medium | Built | |
| IV-12 | The system shall let staff export the ledger as a CSV file. | Medium | Built | |
| IV-13 | The system must not allow an official item to be removed while it has open tickets. | High | Built | |
| IV-14 | The system shall upgrade the existing stock without any alteration and loss. Existing stock must become an opening Stock In line, and each open ticket shall get a Reserved line. Both must be marked as migrated. | High | Built | |

Ledger types and their effect on the counts (Proposed):

| Ledger Type | Change in On Hand | Change in Reserve | When it is used |
| --- | --- | --- | --- |
| Stock in | Plus the quantity | None | Staff add stock. |
| Reserved | None | Plus the quantity | A student request is received. |
| Released | None | Minus the quantity | A ticket is cancelled. |
| Issued | Minus the quantity | Minus the quantity | A ticket is claimed. |
| Sold | Minus the quantity | None | A face to face sale. |
| Adjustment | Plus or minus the quantity | None | A correction or a daily count difference. |

#### 3.2.16 Face to Face Entry, Order Sheet, and Daily Count (new in 1.3)

| ID | Requirement | Priority | Prototype Status | Note |
| --- | --- | --- | --- | --- |
| FF-01 | The system shall let staff record the walk in sale with items, sizes, and quantities. It must provide a ticket along with the source which is Face to face and the status Claimed, and shall take the stock out as Sold. | High | Built | The order id has a specific form which is FTF-YYMMDD-NNN. When the ticket cannot be created, the stock change is reversed with the Adjustment lines. |
| FF-02 | A face to face sale must be linked to a student account when staff provide the email or student number. The system must check the student limit but not the ordering window. | High | Built | Proposed. The BAO must verify both stated rules. |
| FF-03 | The system shall give the staff a compiled order sheet of all open online tickets, grouped by item and size, alongside with the requested units, On Hand, Reserved, Available, Shortage, and the ticket references. It shall exclude the claimed tickets, cancelled tickets, and face to face sales. | High | Built | The sheet can be exported as a CSV file and printed. |
| FF-04 | Shortage quantity must be determined by decreasing the 'On Hand' inventory from the specific requested units, ensuring the value will never drop below zero. | High | Built | Since the stock is reserved at the request time, a shortage of stocks is rare. |
| FF-05 | The system shall let the staff enter a counted number for each item and size. A difference from On Hand shall need a reason and shall be saved as an Adjustment line named Daily count R-000N with the reason. A count below the Reserved units shall be refused. | Medium | Built | The count is applied fully or not at all. Records and history are kept. How often to count is for the BAO to determine. |

#### 3.2.17 Email Preparation for the Official Store (new in 1.3)

The prototype prepares the messages and never sends them. The decisions which the IT Office must make are in Appendix B and in docs/EMAIL_INTEGRATION.md .

| ID | Requirement | Priority | Prototype Status | Note |
| --- | --- | --- | --- | --- |
| EM-01 | The system must prepare a message for every ticket status (Request Received, Confirmed, On Hold, Ready for Pickup, Claimed, and Cancelled) and for each stock that has low warning, and shall put it in the outbox. | High | Built | Each of the status can be switched on or off. |
| EM-02 | The system must address the student message only to an RTU email address. If the ticket has none, the message shall be marked Skipped. | High | Built | The domain will be the setting (rtu.edu.ph). |
| EM-03 | A student message must hold the reference, the queue number if any, the status, the items, the pickup date, and the claim notes. It must not hold the student number, its name, or any payment link. It must be said that it is automatic. | High | Built | |
| EM-04 | A low stock message shall go to the staff email addresses entered in the settings. If there are none, it shall be marked Skipped. | Medium | Built | |
| EM-05 | The system shall never forward an email from the browser. The sending switch shall stay off and locked until the IT Office decisions are made and confirmed alongside with a proper server that exists. No mail provider, address, or credential shall be stored in the front end code. | High | Built | A server build can register a provider. |
| EM-06 | The system shall let the staff view the outbox, preview each of the messages, and export the outbox as JSON. | Medium | Built | The outbox keeps the newest 500 entries. |

#### 3.2.18 Other Prototype Features (new in 1.3)

| ID | Requirement | Priority | Prototype Status | Note |
| --- | --- | --- | --- | --- |
| PX-01 | The system must let a user mark products and sellers as favorites and view them on a Favorites page. | Medium | Built | |
| PX-02 | The system must let a user upload, replace, and remove a profile picture, and shall show it on the top bar, reviews, forum, messages, and even on the seller pages. | Medium | Built | JPEG, PNG, or WebP, up to 5 MB. |
| PX-03 | The system shall require confirmation before processing critical state changes and destructive database operations such as cancelling an order, deleting a listing or post, removing an official product, or suspending a member. | Medium | Built | A Cancel and Confirm dialog, then a short toast. |
| PX-04 | The system must provide staff with a Transactions page where every request has a unique TXN id, items saved at the time, quantity, total, buyer, seller, date, status, and status history. The staff shall be able to search, filter, and export it as a CSV file. | High | Built | Student to student records are on read only form for staff. |
| PX-05 | The system must provide staff with a user and audit page to manage accounts, remove or restore student listings, hide official items, and read the audit log. | High | Built | See AD-01 and AD-04. |
| PX-06 | The system shall let staff download all data as a JSON backup, import a backup, and reset everything from its source.. | Low | Built | For prototype only. A full system would use a database for backups (RL02). |
| PX-07 | The system shall offer a light theme and a dark theme for users to have a choice. | Low | Built | |

### 3.3 Non-Functional Requirements

The numbers in this section are starting targets. They will be checked during testing. Numbers marked "proposed" are new suggestions in version 1.2. The research paper (Section 2.7) evaluates the system with the ISO/IEC 25010:2011 quality characteristics, and the table shows where each one is covered. For this section, Not measured means that the prototype does not check the target, since it has no server and no test with real users yet.

| ISO/IEC 25010 Characteristic | Coverage in this SRS |
| --- | --- |
| Functional Suitability | Section 3.2 (all functional requirements, including 3.2.14 to 3.2.18) |
| Performance Efficiency | Section 3.3.1 (PF-01 to PF-04) |
| Compatibility | Section 3.3.5 (RL-04) |
| Usability | Section 3.3.4 (UX-01 to UX-05) |
| Reliability | Section 3.3.5 (RL-01 to RL-03, RL-05) |
| Security | Sections 3.3.2 and 3.3.3 (SE-01 to SE-08, PR-01 to PR-06) |
| Maintainability | Section 3.3.6 (MN-01 to MN-03) |
| Portability | Sections 3.3.4 and 3.3.5 (UX-01 and RL-04) |

#### 3.3.1 Performance

| ID | Requirement | Priority | Prototype Status | Note |
| --- | --- | --- | --- | --- |
| PF-01 | Normal pages shall load within 3 seconds for at least 95% of page loads, measured on the pilot campus network and on mobile data. | Medium | Not measured | The prototype only runs from local files or local hosts. |
| PF-02 | Marketplace search queries and filtered views shall return results within 3 seconds. | Medium | Not measured | |
| PF-03 | AI screening shall normally finish within 30 seconds. While waiting, the user shall be told the content is pending. | Medium | Not yet | No AI screening in prototype. |
| PF-04 | The system shall support at least 200 users online at the same time. | Medium | Not measured | The prototype has no server. |

#### 3.3.2 Security

| ID | Requirement | Priority | Prototype Status | Note |
| --- | --- | --- | --- | --- |
| SE-01 | Passwords shall be stored in hashed form and never as plain text. | High | Partly | Passwords are scrambled within a simple function. This is not a strong hashing. The server needs a proper password hashing. |
| SE-02 | All client-server and external API network traffic shall be encrypted via HTTPS. | High | Not yet | The prototype has no server. |
| SE-03 | The system shall control access by role (Visitor, User, Office Staff, Moderator, Administrator). | High | Partly | The pages and actions for staff only are checked in the browser. Someone who edits the page or the saved data can bypass them. |
| SE-04 | The system shall check all user input and protect against common web attacks such as SQL injection, cross-site scripting, and cross-site request forgery. | High | Partly | The user text is escaped when it is shown. The photos are checked by their content. Server side protection is not applicable on the prototype. |
| SE-05 | Sessions shall expire after 30 minutes of no activity. After 5 failed log-ins in a row, the account shall be locked for 15 minutes. | Medium | Not yet | Sign up code allows 5 tries, which was a different rule. |
| SE-06 | File uploads shall be limited to image files within a set size limit. | Medium | Built | JPEG, PNG, or WebP up to 5 MB, at least 100 px, up to 5 photos per listing and 4 per forum post. Photos are resized and saved again as JPEG. |
| SE-07 | Every rule that protects the Official Store (staff only changes, no negative stock, the status rules, windows, and the limits) shall be repeated on a server before it is launched. | High | Not yet | New in 1.2. In the prototype these rules apply in the browser only. |
| SE-08 | It must not provide or place the email key, password, or provider secret in the front end code. | High | Partly | New in 1.2. The Official Store email code has none. The older sign up mailer (EmailJS) keeps its public settings in js/0- config.js , and the IT Office must come up whether to keep it or not. |

#### 3.3.3 Privacy

| ID | Requirement | Priority | Prototype Status | Note |
| --- | --- | --- | --- | --- |
| PR-01 | The system shall follow the Data Privacy Act of 2012 (RA 10173) and collect only the personal data it needs. | High | Partly | The Official Store email excludes the student number and name. A privacy review by the university has not been done. |
| PR-02 | The system shall show a privacy notice and get the user's consent when the user registers. The notice shall say what data is collected and why, that cleaned text is sent to the LLM service and the email address to the email service, how long data is kept, and how to reach the university's data privacy office (contact details to come from the university). | High | Not yet | The prototype footer has no Privacy Policy or contact link because the details were not supplied. |
| PR-03 | The system shall let a user view and correct their personal data and request deletion of their account. Deletion follows PR-06. | High | Partly | Users can edit their own profile. Account deletion is not available in the prototype. |
| PR-04 | The system shall restrict internal access to personal user data based on administrative roles, ensuring moderators can view private content only when it is explicitly reported. | High | Partly | Staff pages are restricted in the browser. Staff cannot read between the private chats of its users. |
| PR-05 | The system shall follow a data retention period that is defined and documented (to be confirmed, see Appendix B). | Medium | Not yet | |
| PR-06 | When an account is deleted, the system shall remove the user's personal data (name, email, contact number, and photo). Order records and published reviews shall stay, shown without the user's name, for the retention period in PR-05. | High | Not yet | |

#### 3.3.4 Usability

| ID | Requirement | Priority | Prototype Status | Note |
| --- | --- | --- | --- | --- |
| UX-01 | Every function shall be usable on phone browsers with screen widths of 360 pixels, with no sideways scrolling of the page. | High | Partly | The layout is responsive and user friendly. The landing page, Store orders, and Store inventory pages were checked at phone width with no sideways scrolling. Not every page was measured exactly at 360 px. |
| UX-02 | In a test with 10 new users, at least 8 shall post a listing within 5 minutes without instructions. | Medium | Not yet | No user test yet. |
| UX-03 | The interface shall be in plain English. Listings, posts, and messages may be written in English, Filipino, or a mix of both. | Medium | Built | |
| UX-04 | The system shall display clear, human-readable error messages whenever an exception occurs and guide the user on corrective next steps. | Medium | Built | Forms show errors under the field. Success shows a short toast. |
| UX-05 | Text and background colors shall meet WCAG 2.1 level AA contrast: at least 4.5 to 1 for normal text and 3 to 1 for large text. | Medium | Not measured | |

#### 3.3.5 Reliability and Compatibility

| ID | Requirement | Priority | Prototype Status | Note |
| --- | --- | --- | --- | --- |
| RL-01 | The system shall be available at least 95% of the time each month, not counting planned maintenance. | Medium | Not measured | The prototype has no server. |
| RL-02 | The system shall perform automated daily backups of the application database. | High | Partly | The staff can download and import a JSON file backup by hand. |
| RL-03 | Historical order and transaction records shall remain intact and accessible even if a user deletes associated chat messages, product listings, or forum posts. | High | Partly | All records still keep the items as they were at the time. |
| RL-04 | The system shall work on the latest versions of Chrome, Edge, Firefox, and Safari, on desktop and mobile. | High | Partly | Only tested in Chromium. |
| RL-05 | The stock counts of the Official Store must always agree along with the stock ledger and open tickets. | High | Built | Added in 1.2. The staff can operate the ledger check. Changes can be applied fully or not at all. |

#### 3.3.6 Maintainability

| ID | Requirement | Priority | Prototype Status | Note |
| --- | --- | --- | --- | --- |
| MN-01 | Application source code shall be structured into modular components and accompanied by clear technical documentation to facilitate maintenance by future developers. | Medium | Built | Separate script files with a FILE GUIDE comment, plus README.md and CODE_GUIDE.md. |
| MN-02 | Marketplace product categories and AI screening policy rules shall be configurable directly through the Administrator Panel without requiring code deployments. | Medium | Partly | The Official Store statuses, transitions, item types, windows, limits, and low stock levels are editable by the staff. Marketplace categories are fixed in code. |
| MN-03 | A software upgrade must change the saved data safely: it shall be repeatable, keep the TXN references and its history, and must not delete nothing. | High | Built | Added in 1.2 |

### 3.4 Business Rules

| ID | Rule | Prototype note |
| --- | --- | --- |
| BR-01 | Only authenticated users verified as members of the RTU Pasig community are permitted to buy, sell, exchange messages, or publish forum content. | Checked in the browser. |
| BR-02 | Financial payments are settled directly between the buyer and seller outside the platform; the system does not process monetary transactions. | Official Store payment is at the university office. |
| BR-03 | AI screening is an aid and never the final authority. A person makes the final decision on uncertain content, on confirming every rejection, and on every appeal. An appeal is decided by someone other than the person who made the decision being appealed. | The prototype uses staff to review and has no AI or appeals. |
| BR-04 | Only designated Office Staff are authorized to list items in the Official Store, and only Office Staff and Administrators may publish posts in the Announcements forum category. | |
| BR-05 | A buyer is permitted to submit at most one rating and review per completed order transaction. | |
| BR-06 | A user's personal contact number is disclosed to the counterparty strictly while an order is actively in progress and hidden upon completion or cancellation. | No contact number field yet. |
| BR-07 | Automated screening evaluates text submissions for inappropriate content only and provides no warranty regarding the physical quality, safety, or legality of listed goods. | |
| BR-08 | Platform access and research scope are restricted exclusively to RTU Pasig Campus and do not extend to other university branches such as the Boni Campus. | |
| BR-09 | Stock of an official item changes only through the stock ledger, and every change has a reason or ticket. | Added in 1.2 |
| BR-10 | A ticket reference (TXN id) must not ever change. An upgrade never deletes or renames a record. | Added in 1.2 |
| BR-11 | Every Official Store status, transition, cancellation rule, stock definition, item type, window, limit, queue number format, claim note, and low stock level is a proposal until the BAO verifies it, and shall be alterable without changing the code. | Added in 1.2. See Appendix B. |
| BR-12 | The Official Store emails shall not be sent until the IT Office decisions are come up. A message shall not contain the student number, the student's name, or a payment link. | Added in 1.2 |
| BR-13 | Only the staff admin can change a ticket status or the stock. | Added in 1.2. Only checked in the browser |
| BR-14 | A face to face sale counts toward the limit but is not blocked by the ordering window. | Added in 1.2. Proposed. The BAO must verify it. |

## Appendix A. Traceability

A.1 to A.5 (problem statements, significance, design points from the literature, the research gap, and the survey items) are unchanged from version 1.1. The file used for this update ended at section 3.4, so their text is not repeated here. Paste them from version 1.1 if one file is needed.

| Requirements | Source |
| --- | --- |
| OS-01 to OS-12 (tickets), ST-04 to ST-06 | Interview recommendations from the Official Store office, and the prototype Store orders page. |
| IV-01 to IV-14 (stock), RL-05 | Interview recommendations on inventory, and the prototype Store inventory page. |
| FF-01 to FF-05 (face to face, order sheet, daily count) | Interview recommendations on walk in sales and reconciliation. |
| EM-01 to EM-06, NT-02, SE-07, SE-08, BR12 | Interview recommendations on notifications, and docs/EMAIL_INTEGRATION.md. |
| PX-01 to PX-07, AV-10, AV-11, LS-02, LS-05 | Prototype versions 1.3 to 1.5 (README and CODE_GUIDE). |

### A.6 Sources of the Requirements Added in Version 1.3

| Requirements | Source |
| --- | --- |
| OS-01 to OS-12 (tickets), ST-04 to ST-06 | Interview recommendations from the Official Store office, and the prototype Store orders page |
| IV-01 to IV-14 (stock), RL-05 | Interview recommendations on inventory, and the prototype Store inventory page |
| FF-01 to FF-05 (face to face, order sheet, daily count) | Interview recommendations on walk-in sales and reconciliation |
| EM-01 to EM-06, NT-02, SE-07, SE-08, BR-12 | Interview recommendations on notifications, and docs/EMAIL_INTEGRATION.md |
| PX-01 to PX-07, AV-10, AV-11, LS-02, LS-05 | Prototype versions 1.3 to 1.5 (README and CODE_GUIDE) |

## Appendix B. Items to Confirm

These items are open. The prototype uses a proposed value for each BAO item, shown in the list, and every one of them can be edited by staff.

### B.1 for the BAO

| No. | Item | Proposed value in the prototype |
| --- | --- | --- |
| 1 | Status names and the allowed order of changes. | Request Received, Confirmed, On Hold, Ready for Pickup, Claimed, Cancelled (see 3.2.14) |
| 2 | Whether a student can cancel, and from which statuses. | Only from Request Received. |
| 3 | Whether a ticket On Hold keeps its reserved stock. | Yes, it keeps it. |
| 4 | The meaning of On Hand, Reserved, and Available. | Available = On Hand − Reserved. |
| 5 | The difference between Issued (online claim) and Sold (face to face). | Issued takes stock out when a ticket is claimed. Sold takes it out at a walk-in sale. |
| 6 | Item types and how they map to categories, including Sablay. | Sablay, Book, Uniform, Merchandise, Other |
| 7 | Ordering windows, and the scope and period of the limit per student. | Off. A limit counts all tickets that are not cancelled. |
| 8 | The status of a face to face sale, and whether the ordering window applies to it. | Claimed, and the window does not apply |
| 9 | The queue number format and whether to use it. | Off. No format assumed. |
| 10 | The claim notes wording, store-wide and for each item. | Empty |
| 11 | How often the daily count is done. | No schedule |
| 12 | Low stock levels and who receives the warnings. | No default level. No recipients. |
| 13 | Item information, sizes, and stock rules for each item. | Not assumed. Staff enter them. |

### B.2 for the IT office

| No. | Item |
| --- | --- |
| 1 | The approved mail service, the sender address and its name, and whether a no-reply address is acceptable. |
| 2 | Where the server runs, and who holds the secrets. |
| 3 | Sending limits, and SPF, DKIM, and DMARC setup. |
| 4 | A data privacy review (DPO): what an email may hold, how long the outbox is kept, and who can read and access it. |
| 5 | How bounces and failed sends are handled. |
| 6 | Who signs off on the wording of each message. |
| 7 | Whether to keep the sign-up mailer (EmailJS) or move it to the server. |
| 8 | Server-side login, password hashing, roles, and repeated checks for every Official Store rule (SE-01, SE-03, SE-07). |

### B.3 for the University

| No. | Item |
| --- | --- |
| 1 | The contact email, Privacy Policy, and Terms of Use for the footer (not supplied, so none is shown). |
| 2 | The data retention period (PR-05). |
| 3 | The LLM service and the written screening rules, if AI screening goes ahead. |

### B.4 for the Proponents

| No. | Item |
| --- | --- |
| 1 | Merge the Appendix B items from version 1.1 if that file exists. |

The missing 1.2 revision row has been added as version 1.3 in this edition.

## Appendix C. Prototype Record

The prototype is version 1.6. It is plain HTML, CSS, and JavaScript with no server. The automated browser tests below were run on October 30, 2026 on the build that adds the Official Store changes to the version 1.5 files supplied by the team. All checks passed.

| Test | What it covers | Checks passed |
| --- | --- | --- |
| Stage 1 | Tickets, statuses, history, student view | 71 |
| Stage 2 | Stock, ledger, types, low stock, windows, limits | 82 |
| Stage 3 | Face to face entry, order sheet, daily count | 52 |
| Stage 4 | Email outbox and settings | 33 |
| Upgrade from version 1.5 data | Tickets and stock keep their ID’s and history | 23 |
| Marketplace flow | Student marketplace, student sellers, official store browsing, sign-in | 46 |
| Upgrade from version 1.4 data | Older saved data opens in the new build | 27 |
| Navigation | Routes and staff only pages for guests | 18 |
| Smoke test | Main pages open | 16 |
| Upgrade check | Older saved data | 8 |

These are the parts that are not tested: Real email sending (nothing is sent), used by several people at the same time, server, and browsers other than Chromium. Two older test files fail in the same way on the unchanged version 1.5. They are out of date and were not run on this build.

## Appendix D. Changes from Version 1.1

| Part | Change |
| --- | --- |
| All of 3.2 and 3.3 | A Prototype status and a Note column were added. |
| AV-03 | A 6-digit code replaces the verification link in the prototype. |
| AV-10 | States are Active, Suspended, and Banned. |
| AV-11 | Visitors can also see a limited preview of Books and RTU Merchandise. |
| LS-02 | New category list, with Services as its own category. |
| LS-05 | Staff approval replaces AI screening in the prototype. |
| BD-08 (second), ST-05 (second) | Renumbered to BD-09 and ST-06. |
| ST-04, ST-05, ST-06 | Reworded for the new stock and ticket rules. |
| NT-02 | Official Store emails are allowed once the IT Office approves them. |
| 3.2.14 to 3.2.18 | New: tickets, stock, face to face entry and daily count, email preparation, other prototype features. |
| SE-07, SE-08, RL-05, MN-03 | New quality requirements. |
| BR-09 to BR-14 | New business rules. |
| Appendices B, C, and D | New lists of items to confirm and the prototype record. |

---

*Fixed edition. See `SRS-v1.3-FIXES.md` for the list of corrections.*
