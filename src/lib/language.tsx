'use client';

import React, { createContext, useContext, useMemo, useState } from 'react';

export type AppLanguage = 'en' | 'bn';

const BANGLA: Record<string, string> = {
  English: 'English',
  Bangla: 'বাংলা',
  'Website language': 'ওয়েবসাইটের ভাষা',
  'Clinical Clarity': 'চিকিৎসায় স্পষ্টতা',
  'Close navigation menu': 'নেভিগেশন মেনু বন্ধ করুন',
  'Open navigation menu': 'নেভিগেশন মেনু খুলুন',
  'Workspace Navigation': 'ওয়ার্কস্পেস নেভিগেশন',
  'Clinical Workspace': 'ক্লিনিক্যাল ওয়ার্কস্পেস',
  'Account & Governance': 'অ্যাকাউন্ট ও গোপনীয়তা',
  'Clinical Operations': 'ক্লিনিক্যাল কার্যক্রম',
  'Patient Workspace Preview': 'রোগীর ওয়ার্কস্পেস',
  'Overview': 'সারসংক্ষেপ',
  'AI Health Assessment': 'এআই স্বাস্থ্য মূল্যায়ন',
  'Assessment History': 'মূল্যায়নের ইতিহাস',
  'Medical Records & Labs': 'স্বাস্থ্য রেকর্ড ও পরীক্ষা',
  'Find Care & Doctors': 'চিকিৎসা ও ডাক্তার খুঁজুন',
  'Notifications': 'বিজ্ঞপ্তি',
  'Privacy & Settings': 'গোপনীয়তা ও সেটিংস',
  'Impact & Metrics': 'কার্যক্রম ও পরিমাপ',
  'Clinician Review Queue': 'চিকিৎসকের পর্যালোচনা তালিকা',
  'Sample Triage Results': 'নমুনা ট্রায়াজ ফলাফল',
  'Provider Directory': 'সেবা প্রদানকারীর তালিকা',
  'Patient Dashboard': 'রোগীর ড্যাশবোর্ড',
  'AI Symptom Triage': 'এআই উপসর্গ যাচাই',
  'Find Specialists': 'বিশেষজ্ঞ খুঁজুন',
  'Health Vault': 'স্বাস্থ্য রেকর্ড',
  'Clinical Impact': 'ক্লিনিক্যাল কার্যক্রম',
  'Sign In': 'সাইন ইন',
  'Browse sample provider profiles across Bangladesh. These demo records do not represent verified clinicians or real facilities.': 'বাংলাদেশজুড়ে নমুনা সেবাদাতার প্রোফাইল দেখুন। এই তথ্য প্রদর্শনীর জন্য; চিকিৎসক বা প্রতিষ্ঠান যাচাইকৃত নয়।',
  'Use your current location to sort sample providers by distance.': 'দূরত্ব অনুযায়ী নমুনা সেবাদাতা সাজাতে আপনার বর্তমান অবস্থান ব্যবহার করুন।',
  'Experiencing a Medical Emergency?': 'জরুরি চিকিৎসা প্রয়োজন?',
  'Specialties:': 'বিশেষজ্ঞতা:',
  'Medical Records Vault': 'স্বাস্থ্য রেকর্ড ভাণ্ডার',
  'Privacy & Governance': 'গোপনীয়তা ও নীতিমালা',
  'New AI Assessment': 'নতুন এআই মূল্যায়ন',
  'Emergency Help': 'জরুরি সহায়তা',
  'Search specialists, labs, or guidelines...': 'বিশেষজ্ঞ, পরীক্ষা বা নির্দেশিকা খুঁজুন...',
  'Notifications (': 'বিজ্ঞপ্তি (',
  'Switch Active Clinical Persona': 'বর্তমান ব্যবহারকারীর ভূমিকা বদলান',
  'Active Session Persona (RBAC)': 'বর্তমান সেশনের ভূমিকা',
  'Switch roles to test Patient, Clinician, and Admin permissions.': 'রোগী, চিকিৎসক ও প্রশাসকের ভিন্ন দৃশ্য দেখতে ভূমিকা বদলান।',
  'Patient View': 'রোগী',
  'Clinician Reviewer': 'চিকিৎসক পর্যালোচক',
  'CMO Admin Portal': 'প্রধান চিকিৎসা কর্মকর্তার পোর্টাল',
  'Internal Medicine & Pulmonology': 'মেডিসিন ও শ্বাসতন্ত্র',
  'Chief Medical Officer': 'প্রধান চিকিৎসা কর্মকর্তা',
  'Verified Patient': 'নিবন্ধিত রোগী',
  'Nusrat Jahan': 'নুসরাত জাহান',
  'Dr. Ayesha Rahman, MBBS, FCPS': 'ডা. আয়েশা রহমান, এমবিবিএস, এফসিপিএস',
  'Dr. Farhan Ahmed, MBBS, MPH': 'ডা. ফারহান আহমেদ, এমবিবিএস, এমপিএইচ',
  'Immediate Emergency Guidance': 'তাৎক্ষণিক জরুরি নির্দেশনা',
  'Contact Local Emergency Services': 'স্থানীয় জরুরি সেবায় যোগাযোগ করুন',
  'If you are in Bangladesh and experiencing any of the following red-flag symptoms, do not wait for an online clinician review. Call 999 or go to the nearest emergency department now.': 'বাংলাদেশে নিচের কোনো গুরুতর লক্ষণ দেখা দিলে অনলাইন চিকিৎসকের পর্যালোচনার জন্য অপেক্ষা করবেন না। এখনই ৯৯৯ নম্বরে কল করুন অথবা নিকটস্থ জরুরি বিভাগে যান।',
  'Crushing chest pain, pressure, or pain radiating to the left arm, back, or jaw': 'বুকে তীব্র ব্যথা বা চাপ, অথবা বাম হাত, পিঠ কিংবা চোয়ালে ছড়িয়ে পড়া ব্যথা',
  'Severe shortness of breath at rest, gasping for air, or bluish lips/face': 'বিশ্রামেও তীব্র শ্বাসকষ্ট, হাঁসফাঁস করা, অথবা ঠোঁট/মুখ নীলচে হওয়া',
  'Sudden facial droop, arm weakness, slurred speech (FAST stroke signs)': 'হঠাৎ মুখ বেঁকে যাওয়া, হাতে দুর্বলতা, জড়িয়ে কথা বলা (স্ট্রোকের লক্ষণ)',
  'Throat/tongue swelling, severe allergic anaphylaxis, or uncontrolled bleeding': 'গলা/জিহ্বা ফুলে যাওয়া, তীব্র অ্যালার্জি, অথবা রক্তপাত বন্ধ না হওয়া',
  'Thoughts of self-harm or an acute psychiatric crisis': 'নিজেকে আঘাত করার চিন্তা বা তীব্র মানসিক সংকট',
  'Call Bangladesh emergency services on 999': 'বাংলাদেশের জরুরি সেবা ৯৯৯ নম্বরে কল করুন',
  'Call 999': '৯৯৯ নম্বরে কল করুন',
  'Close guidance': 'নির্দেশনা বন্ধ করুন',
  'Find Care by Specialty & Division': 'বিশেষজ্ঞ ও বিভাগ অনুযায়ী সেবা খুঁজুন',
  'Bangladesh care directory · illustrative demo data': 'বাংলাদেশের সেবা তালিকা · প্রদর্শনীর নমুনা তথ্য',
  'Division in Bangladesh': 'বাংলাদেশের বিভাগ',
  'All Bangladesh divisions': 'সব বিভাগ',
  'Search Directory': 'তালিকা খুঁজুন',
  'Specialty, Condition, or Clinician Name': 'বিশেষজ্ঞতা, সমস্যা বা চিকিৎসকের নাম',
  'Coverage Region': 'সেবা অঞ্চল',
  'Use my location': 'আমার অবস্থান ব্যবহার করুন',
  'Refresh location': 'অবস্থান হালনাগাদ করুন',
  'Refresh GPS': 'জিপিএস হালনাগাদ',
  'Locating…': 'অবস্থান খোঁজা হচ্ছে…',
  'Showing ': 'দেখানো হচ্ছে ',
  ' sample clinicians in': ' জন নমুনা চিকিৎসক · অঞ্চল:',
  'List View': 'তালিকা',
  'Split Map': 'তালিকা ও মানচিত্র',
  'All': 'সব',
  'Cardiology': 'হৃদরোগ',
  'Pulmonology': 'শ্বাসতন্ত্র',
  'Neurology': 'স্নায়ুরোগ',
  'Internal Medicine': 'মেডিসিন',
  'Dermatology': 'চর্মরোগ',
  'Endocrinology': 'হরমোন ও ডায়াবেটিস',
  'Urgent Care': 'জরুরি চিকিৎসা',
  'Telehealth': 'অনলাইন চিকিৎসা',
  'In-Network': 'নেটওয়ার্কভুক্ত',
  'Available Today': 'আজ উপলভ্য',
  'Reset': 'রিসেট',
  'sample clinicians': 'নমুনা চিকিৎসক',
  'Loading care directory...': 'সেবার তালিকা লোড হচ্ছে...',
  'No clinicians matched your criteria': 'আপনার শর্তে কোনো চিকিৎসক পাওয়া যায়নি',
  'Try widening your region or clearing specific filters.': 'অন্য বিভাগ নির্বাচন করুন অথবা ফিল্টার মুছে আবার চেষ্টা করুন।',
  'Reset All Filters': 'সব ফিল্টার মুছুন',
  'Care access: Bangladesh': 'বাংলাদেশে সেবা',
  'Care access: Dhaka': 'সেবা: ঢাকা',
  'Care access: Chattogram': 'সেবা: চট্টগ্রাম',
  'Care access: Sylhet': 'সেবা: সিলেট',
  'Care access: Rajshahi': 'সেবা: রাজশাহী',
  'Care access: Khulna': 'সেবা: খুলনা',
  'Care access: Barishal': 'সেবা: বরিশাল',
  'Care access: Rangpur': 'সেবা: রংপুর',
  'Care access: Mymensingh': 'সেবা: ময়মনসিংহ',
  'Explore Bangladesh coverage': 'বাংলাদেশে সেবার এলাকা দেখুন',
  'Nearby sample providers': 'কাছাকাছি নমুনা সেবাকেন্দ্র',
  'Start Assessment': 'মূল্যায়ন শুরু করুন',
  'Patient Workspace': 'রোগীর ওয়ার্কস্পেস',
  'AI Triage Workspace': 'এআই ট্রায়াজ ওয়ার্কস্পেস',
  'Media & Voice Intake': 'ছবি ও কণ্ঠে তথ্য দিন',
  'Health Profile & Lab Vault': 'স্বাস্থ্য প্রোফাইল ও পরীক্ষার নথি',
  'Clinical Verification': 'ক্লিনিক্যাল পর্যালোচনা',
  'Clinical Assessment Results': 'ক্লিনিক্যাল মূল্যায়নের ফলাফল',
  'Clinician Review Tracker': 'চিকিৎসক পর্যালোচনার অগ্রগতি',
  'Specialist & Care Directory': 'বিশেষজ্ঞ ও সেবার তালিকা',
  'Governance & Trust': 'নীতিমালা ও আস্থা',
  'Privacy & Consent Settings': 'গোপনীয়তা ও সম্মতির সেটিংস',
  'Notification Center': 'বিজ্ঞপ্তি কেন্দ্র',
  'CMO Impact & Audit Telemetry': 'প্রধান চিকিৎসা কর্মকর্তার প্রভাব ও নিরীক্ষা',
  'Clinical decision support for clearer intake, transparent next steps, and clinician review.': 'সহজ তথ্য সংগ্রহ, স্বচ্ছ পরবর্তী পদক্ষেপ এবং চিকিৎসকের পর্যালোচনার জন্য ক্লিনিক্যাল সহায়তা।',
};

export function translate(language: AppLanguage, text: string): string {
  return language === 'bn' ? BANGLA[text] ?? text : text;
}

interface LanguageContextValue {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  t: (text: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({
  initialLanguage,
  children,
}: {
  initialLanguage: AppLanguage;
  children: React.ReactNode;
}) {
  const [language, setLanguageState] = useState<AppLanguage>(initialLanguage);
  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage: (nextLanguage) => {
        setLanguageState(nextLanguage);
        document.cookie = `cn_language=${nextLanguage}; Path=/; Max-Age=31536000; SameSite=Lax`;
        window.localStorage.setItem('cn_language', nextLanguage);
        document.documentElement.lang = nextLanguage;
      },
      t: (text) => translate(language, text),
    }),
    [language]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider.');
  return context;
}
