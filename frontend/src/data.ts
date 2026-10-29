/* Fixed texts for the page. They are copied from the RTU Tindahan prototype, so both stay the same. */

export type Slide = {
  tone: string
  label: string
  title: string
  text: string
  icons: [string, string, string]
}

export const SLIDES: Slide[] = [
  {
    tone: 'food',
    label: 'Food and snacks',
    title: 'Merienda between classes',
    text: 'Home-cooked snacks and drinks from RTU students, ready for campus pickup.',
    icons: ['bowl', 'cup', 'tag'],
  },
  {
    tone: 'study',
    label: 'Books and supplies',
    title: 'Books, notes and school supplies',
    text: 'Textbooks, calculators and supplies at student prices.',
    icons: ['book', 'calc', 'note'],
  },
  {
    tone: 'print',
    label: 'Student services',
    title: 'Services from students',
    text: 'Printing, tutoring and other help from students who are free when you are.',
    icons: ['print', 'user', 'clock'],
  },
  {
    tone: 'merch',
    label: 'RTU merchandise',
    title: 'Official RTU items',
    text: 'Uniforms, books and merchandise published by RTU staff.',
    icons: ['shirt', 'store', 'shield'],
  },
]

export const FAQ: [string, string][] = [
  [
    'Who can use RTU Tindahan?',
    'Only verified RTU members. You sign up with your RTU email (it ends with @rtu.edu.ph) and a code that is sent to it. Guests can look around, but cannot buy, sell, search or message.',
  ],
  [
    'How do I create an account?',
    'Choose Create account, enter your name, RTU email and a password, then type the 6 digit code that arrives in your RTU inbox. Your account is ready after that.',
  ],
  [
    'Do I pay on the website? Is there delivery?',
    'No. There is no online payment and no delivery. You agree on a visible campus spot and time, check the item, and pay the seller in person.',
  ],
  [
    'What can I sell?',
    'Items and services that are safe to hand over on campus. Staff check every listing before it goes live. Some things are not allowed, such as exam answers, medicines and vaping products.',
  ],
  [
    'I cannot verify my account. What now?',
    'Open the sign-up help page. It walks through the email check step by step.',
  ],
]

export const BENEFITS: { title: string; text: string; icon: string }[] = [
  {
    title: 'For buyers',
    text: 'Find snacks, books, supplies, merchandise and services in one place. Send a request, agree on a time, and pick it up on campus.',
    icon: 'cart',
  },
  {
    title: 'For sellers',
    text: 'List an item or a service, choose your own days and hours, and answer requests from your shop page. Photos, variations and ratings are built in.',
    icon: 'tag',
  },
  {
    title: 'Safe by design',
    text: 'Only verified RTU accounts can trade. Staff approve listings first, meetups happen in visible campus areas, and no money moves online.',
    icon: 'shield',
  },
]

export const STEPS: { title: string; text: string; icon: string }[] = [
  { title: 'Find and request', text: 'Add listings to your request cart. Nothing is charged online.', icon: 'cart' },
  { title: 'Seller responds', text: 'The seller accepts, or suggests a new time and place.', icon: 'msg' },
  {
    title: 'Meet and pay at pickup',
    text: 'Meet in a visible campus area, check the item, then pay the seller in person.',
    icon: 'pin',
  },
]

export const TIPS: { title: string; text: string; icon: string }[] = [
  { title: 'Meet in a visible spot', text: 'Choose a busy campus area such as the main lobby, library or canteen.', icon: 'pin' },
  { title: 'Check before you pay', text: 'Look at the item or service first. Pay the seller in person only when you are happy.', icon: 'eye' },
  { title: 'Keep chats on Tindahan', text: 'Use Messages inside the site so staff can help if something goes wrong.', icon: 'msg' },
]

export const GUIDELINES = [
  'Be honest about what you sell, including its condition.',
  'Meet only at visible spots inside Pasig Campus.',
  'Pay in person. RTU Tindahan never handles money or delivery.',
  'No exam answers, vaping products, medicines, resale tickets or weapons.',
  'Treat every student and staff member with respect.',
]

export const POLICY = [
  'Exam answers, test papers and similar material',
  'Medicines, supplements and regulated health products',
  'Vaping products and tobacco',
  'Tickets sold above face value',
  'Weapons and dangerous items',
  'Anything that cannot be handed over safely on campus',
]

export const GUEST_PAGES = {
  books: {
    label: 'Books and Academic Materials',
    eyebrow: 'Study materials',
    icon: 'book',
    heading: 'Textbooks, lab manuals and reviewers',
    blurb: 'Prescribed textbooks, lab manuals and student reviewers at campus prices.',
    tipsTitle: 'Before you buy a used book or manual',
    tips: [
      'Check that the edition matches your syllabus.',
      'Flip through every page. Look for torn or missing sheets.',
      'Ask the seller for extra photos if you cannot meet right away.',
      'Meet at the library entrance or main lobby.',
      'Pay only after you have checked the item.',
    ],
  },
  merch: {
    label: 'RTU Merchandise',
    eyebrow: 'Uniforms and merch',
    icon: 'shirt',
    heading: 'Uniforms, bags and RTU keepsakes',
    blurb: 'Official uniforms and merchandise from the campus store, plus handmade RTU items from students.',
    tipsTitle: '',
    tips: [] as string[],
  },
} as const

export const VERIFY_STEPS = [
  'Choose Create account and enter your first name, last name and RTU email. The email ends with @rtu.edu.ph.',
  'Choose a password and type it twice.',
  'Open your RTU inbox and find the message with a 6 digit code.',
  'Type the code on the sign-up page. Your account is ready after that.',
]
