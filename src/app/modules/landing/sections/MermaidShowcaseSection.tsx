import { FC, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DIAGRAM_TABS, DiagramTab } from '../landingData';

/* ── 1. Sequence Diagram Vector SVG ── */
const SequenceVisual: FC = () => (
  <svg viewBox="0 0 540 345" className="lp-vector-diagram-svg" aria-label="Sequence Diagram Vector Preview">
    <defs>
      <linearGradient id="seqActorGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#1e293b" />
        <stop offset="100%" stopColor="#0f172a" />
      </linearGradient>
      <linearGradient id="seqAccentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#6c63ff" />
        <stop offset="100%" stopColor="#8b5cf6" />
      </linearGradient>
      <marker id="seqArrowPurple" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#818cf8" />
      </marker>
      <marker id="seqArrowCyan" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#38bdf8" />
      </marker>
      <marker id="seqArrowGreen" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#34d399" />
      </marker>
    </defs>

    {/* Background Grid Pattern */}
    <rect x="0" y="0" width="540" height="345" rx="12" fill="#0d121c" />

    {/* 4 Vertical Lifelines */}
    <line x1="68" y1="44" x2="68" y2="302" stroke="#334155" strokeWidth="1.5" strokeDasharray="4 4" />
    <line x1="202" y1="44" x2="202" y2="302" stroke="#334155" strokeWidth="1.5" strokeDasharray="4 4" />
    <line x1="336" y1="44" x2="336" y2="302" stroke="#334155" strokeWidth="1.5" strokeDasharray="4 4" />
    <line x1="470" y1="44" x2="470" y2="302" stroke="#334155" strokeWidth="1.5" strokeDasharray="4 4" />

    {/* Top Participant Boxes */}
    <g>
      {/* Client App */}
      <rect x="18" y="14" width="100" height="30" rx="7" fill="url(#seqActorGrad)" stroke="#6c63ff" strokeWidth="1.5" />
      <text x="68" y="33" fill="#f1f5f9" fontSize="11" fontWeight="700" textAnchor="middle">Client App</text>

      {/* API Gateway */}
      <rect x="152" y="14" width="100" height="30" rx="7" fill="url(#seqActorGrad)" stroke="#38bdf8" strokeWidth="1.5" />
      <text x="202" y="33" fill="#f1f5f9" fontSize="11" fontWeight="700" textAnchor="middle">API Gateway</text>

      {/* Auth Server */}
      <rect x="286" y="14" width="100" height="30" rx="7" fill="url(#seqActorGrad)" stroke="#a78bfa" strokeWidth="1.5" />
      <text x="336" y="33" fill="#f1f5f9" fontSize="11" fontWeight="700" textAnchor="middle">Auth Server</text>

      {/* MongoDB Atlas */}
      <rect x="420" y="14" width="100" height="30" rx="7" fill="url(#seqActorGrad)" stroke="#10b981" strokeWidth="1.5" />
      <text x="470" y="33" fill="#f1f5f9" fontSize="11" fontWeight="700" textAnchor="middle">MongoDB Atlas</text>
    </g>

    {/* Message 1: Client -> API Gateway */}
    <g>
      <line x1="68" y1="75" x2="194" y2="75" stroke="#818cf8" strokeWidth="1.8" markerEnd="url(#seqArrowPurple)" />
      <circle cx="92" cy="75" r="11" fill="#6c63ff" stroke="#0d121c" strokeWidth="3.5" />
      <text x="92" y="75" fill="#ffffff" fontSize="11" fontWeight="800" textAnchor="middle" dominantBaseline="central">1</text>
      <text x="142" y="65" fill="#f1f5f9" fontSize="10.5" fontWeight="600" textAnchor="middle">POST /v1/auth/login</text>
    </g>

    {/* Message 2: API Gateway -> Auth Server */}
    <g>
      <line x1="202" y1="115" x2="328" y2="115" stroke="#818cf8" strokeWidth="1.8" markerEnd="url(#seqArrowPurple)" />
      <circle cx="226" cy="115" r="11" fill="#6c63ff" stroke="#0d121c" strokeWidth="3.5" />
      <text x="226" y="115" fill="#ffffff" fontSize="11" fontWeight="800" textAnchor="middle" dominantBaseline="central">2</text>
      <text x="276" y="105" fill="#f1f5f9" fontSize="10.5" fontWeight="600" textAnchor="middle">Validate JWT &amp; Claims</text>
    </g>

    {/* Message 3: Auth Server -> MongoDB Atlas */}
    <g>
      <line x1="336" y1="155" x2="462" y2="155" stroke="#818cf8" strokeWidth="1.8" markerEnd="url(#seqArrowPurple)" />
      <circle cx="360" cy="155" r="11" fill="#6c63ff" stroke="#0d121c" strokeWidth="3.5" />
      <text x="360" y="155" fill="#ffffff" fontSize="11" fontWeight="800" textAnchor="middle" dominantBaseline="central">3</text>
      <text x="410" y="145" fill="#f1f5f9" fontSize="10.5" fontWeight="600" textAnchor="middle">Query User Permissions</text>
    </g>

    {/* Message 4: MongoDB Atlas -->> Auth Server (Return) */}
    <g>
      <line x1="470" y1="195" x2="344" y2="195" stroke="#10b981" strokeWidth="1.8" strokeDasharray="5 3" markerEnd="url(#seqArrowGreen)" />
      <circle cx="446" cy="195" r="11" fill="#059669" stroke="#0d121c" strokeWidth="3.5" />
      <text x="446" y="195" fill="#ffffff" fontSize="11" fontWeight="800" textAnchor="middle" dominantBaseline="central">4</text>
      <text x="396" y="185" fill="#34d399" fontSize="10.5" fontWeight="600" textAnchor="middle">Return User Session</text>
    </g>

    {/* Message 5: Auth Server -->> API Gateway (Token) */}
    <g>
      <line x1="336" y1="235" x2="210" y2="235" stroke="#38bdf8" strokeWidth="1.8" strokeDasharray="5 3" markerEnd="url(#seqArrowCyan)" />
      <circle cx="312" cy="235" r="11" fill="#0284c7" stroke="#0d121c" strokeWidth="3.5" />
      <text x="312" y="235" fill="#ffffff" fontSize="11" fontWeight="800" textAnchor="middle" dominantBaseline="central">5</text>
      <text x="262" y="225" fill="#7dd3fc" fontSize="10.5" fontWeight="600" textAnchor="middle">Issue Access Token (Bearer)</text>
    </g>

    {/* Message 6: API Gateway -->> Client App (200 OK) */}
    <g>
      <line x1="202" y1="275" x2="76" y2="275" stroke="#10b981" strokeWidth="1.8" strokeDasharray="5 3" markerEnd="url(#seqArrowGreen)" />
      <circle cx="178" cy="275" r="11" fill="#059669" stroke="#0d121c" strokeWidth="3.5" />
      <text x="178" y="275" fill="#ffffff" fontSize="11" fontWeight="800" textAnchor="middle" dominantBaseline="central">6</text>
      <text x="128" y="265" fill="#34d399" fontSize="10.5" fontWeight="600" textAnchor="middle">200 OK {`{ token, expires_in }`}</text>
    </g>

    {/* Bottom Participant Boxes */}
    <g>
      <rect x="18" y="304" width="100" height="28" rx="6" fill="url(#seqActorGrad)" stroke="#6c63ff" strokeWidth="1.2" />
      <text x="68" y="322" fill="#94a3b8" fontSize="10.5" fontWeight="600" textAnchor="middle">Client App</text>

      <rect x="152" y="304" width="100" height="28" rx="6" fill="url(#seqActorGrad)" stroke="#38bdf8" strokeWidth="1.2" />
      <text x="202" y="322" fill="#94a3b8" fontSize="10.5" fontWeight="600" textAnchor="middle">API Gateway</text>

      <rect x="286" y="304" width="100" height="28" rx="6" fill="url(#seqActorGrad)" stroke="#a78bfa" strokeWidth="1.2" />
      <text x="336" y="322" fill="#94a3b8" fontSize="10.5" fontWeight="600" textAnchor="middle">Auth Server</text>

      <rect x="420" y="304" width="100" height="28" rx="6" fill="url(#seqActorGrad)" stroke="#10b981" strokeWidth="1.2" />
      <text x="470" y="322" fill="#94a3b8" fontSize="10.5" fontWeight="600" textAnchor="middle">MongoDB Atlas</text>
    </g>
  </svg>
);

/* ── 2. Cloud Architecture Flowchart Vector SVG ── */
const FlowchartVisual: FC = () => (
  <svg viewBox="0 0 540 330" className="lp-vector-diagram-svg" aria-label="Architecture Flowchart Vector Preview">
    <defs>
      <marker id="fcArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#818cf8" />
      </marker>
      <marker id="fcArrowGreen" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#10b981" />
      </marker>
      <marker id="fcArrowAmber" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#f59e0b" />
      </marker>
    </defs>

    {/* Background */}
    <rect x="0" y="0" width="540" height="330" rx="12" fill="#0d121c" />

    {/* Entry: Global Traffic */}
    <rect x="195" y="14" width="150" height="34" rx="17" fill="#1e293b" stroke="#38bdf8" strokeWidth="1.6" />
    <text x="270" y="35" fill="#f1f5f9" fontSize="11" fontWeight="700" textAnchor="middle">Global Traffic (Users)</text>

    <line x1="270" y1="48" x2="270" y2="72" stroke="#818cf8" strokeWidth="1.6" markerEnd="url(#fcArrow)" />

    {/* Edge CDN & WAF */}
    <rect x="180" y="74" width="180" height="36" rx="8" fill="#161b27" stroke="#6c63ff" strokeWidth="1.6" />
    <text x="270" y="96" fill="#f1f5f9" fontSize="11" fontWeight="700" textAnchor="middle">Edge CDN &amp; Cloud WAF</text>

    <line x1="270" y1="110" x2="270" y2="132" stroke="#818cf8" strokeWidth="1.6" markerEnd="url(#fcArrow)" />

    {/* Load Balancer Diamond */}
    <polygon points="270,134 320,158 270,182 220,158" fill="#1e293b" stroke="#a78bfa" strokeWidth="1.6" />
    <text x="270" y="162" fill="#fff" fontSize="10.5" fontWeight="800" textAnchor="middle">LB Cluster</text>

    {/* Primary Route Line (Left) */}
    <path d="M 220 158 L 135 158 L 135 192" fill="none" stroke="#10b981" strokeWidth="1.6" markerEnd="url(#fcArrowGreen)" />
    <rect x="135" y="146" width="76" height="18" rx="4" fill="#064e3b" />
    <text x="173" y="159" fill="#34d399" fontSize="9" fontWeight="700" textAnchor="middle">Primary Region</text>

    {/* DR Failover Line (Right) */}
    <path d="M 320 158 L 405 158 L 405 192" fill="none" stroke="#f59e0b" strokeWidth="1.6" markerEnd="url(#fcArrowAmber)" />
    <rect x="330" y="146" width="70" height="18" rx="4" fill="#451a03" />
    <text x="365" y="159" fill="#fbbf24" fontSize="9" fontWeight="700" textAnchor="middle">DR Failover</text>

    {/* Left Branch: Primary Cluster */}
    <rect x="55" y="194" width="160" height="40" rx="8" fill="#0f172a" stroke="#10b981" strokeWidth="1.5" />
    <text x="135" y="214" fill="#f1f5f9" fontSize="11" fontWeight="700" textAnchor="middle">App Services (Primary)</text>
    <text x="135" y="227" fill="#34d399" fontSize="9" fontWeight="600" textAnchor="middle">99.99% Multi-Zone SLA</text>

    {/* Right Branch: Replica Cluster */}
    <rect x="325" y="194" width="160" height="40" rx="8" fill="#0f172a" stroke="#f59e0b" strokeWidth="1.5" />
    <text x="405" y="214" fill="#f1f5f9" fontSize="11" fontWeight="700" textAnchor="middle">Standby Cluster (DR)</text>
    <text x="405" y="227" fill="#fbbf24" fontSize="9" fontWeight="600" textAnchor="middle">Automated Heartbeat</text>

    {/* Down to Storage */}
    <line x1="95" y1="234" x2="95" y2="264" stroke="#818cf8" strokeWidth="1.5" markerEnd="url(#fcArrow)" />
    <line x1="175" y1="234" x2="230" y2="264" stroke="#10b981" strokeWidth="1.5" markerEnd="url(#fcArrowGreen)" />
    <line x1="405" y1="234" x2="310" y2="264" stroke="#10b981" strokeWidth="1.5" markerEnd="url(#fcArrowGreen)" />

    {/* Redis Cache Cylinder */}
    <rect x="45" y="266" width="100" height="44" rx="6" fill="#1e293b" stroke="#ec4899" strokeWidth="1.4" />
    <text x="95" y="286" fill="#f472b6" fontSize="10.5" fontWeight="700" textAnchor="middle">Redis Cache</text>
    <text x="95" y="299" fill="#94a3b8" fontSize="8.5" textAnchor="middle">Sub-ms Query Cache</text>

    {/* MongoDB Atlas Cluster Cylinder */}
    <rect x="200" y="266" width="140" height="44" rx="6" fill="#1e293b" stroke="#10b981" strokeWidth="1.6" />
    <text x="270" y="286" fill="#34d399" fontSize="11" fontWeight="700" textAnchor="middle">MongoDB Atlas</text>
    <text x="270" y="299" fill="#94a3b8" fontSize="8.5" textAnchor="middle">Replicated Sharded DB</text>

    {/* Cache miss connector */}
    <path d="M 145 288 L 198 288" stroke="#38bdf8" strokeWidth="1.3" strokeDasharray="3 3" />
  </svg>
);

/* ── 3. ER Diagram Vector SVG ── */
const ErVisual: FC = () => (
  <svg viewBox="0 0 540 330" className="lp-vector-diagram-svg" aria-label="ER Schema Diagram Vector Preview">
    <defs>
      <linearGradient id="erHeadUser" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#4f46e5" />
        <stop offset="100%" stopColor="#7c3aed" />
      </linearGradient>
      <linearGradient id="erHeadDoc" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#0284c7" />
        <stop offset="100%" stopColor="#2563eb" />
      </linearGradient>
    </defs>

    <rect x="0" y="0" width="540" height="330" rx="12" fill="#0d121c" />

    {/* Table 1: USER Collection */}
    <g>
      {/* Container & Header */}
      <rect x="25" y="28" width="205" height="258" rx="8" fill="#161b27" stroke="#334155" strokeWidth="1.5" />
      <rect x="25" y="28" width="205" height="36" rx="8" fill="url(#erHeadUser)" />
      <rect x="25" y="56" width="205" height="8" fill="url(#erHeadUser)" />
      <text x="127" y="51" fill="#fff" fontSize="12" fontWeight="800" textAnchor="middle">USER (Collection)</text>

      {/* Row 1: id */}
      <line x1="25" y1="104" x2="230" y2="104" stroke="#263147" strokeWidth="1" />
      <text x="40" y="90" fill="#94a3b8" fontSize="10.5" fontFamily="monospace">string</text>
      <text x="95" y="90" fill="#f1f5f9" fontSize="11" fontWeight="700">id</text>
      <rect x="185" y="78" width="30" height="17" rx="4" fill="#f59e0b" />
      <text x="200" y="90" fill="#000" fontSize="9" fontWeight="900" textAnchor="middle">PK</text>

      {/* Row 2: email */}
      <line x1="25" y1="148" x2="230" y2="148" stroke="#263147" strokeWidth="1" />
      <text x="40" y="134" fill="#94a3b8" fontSize="10.5" fontFamily="monospace">string</text>
      <text x="95" y="134" fill="#f1f5f9" fontSize="11" fontWeight="700">email</text>
      <rect x="180" y="122" width="35" height="17" rx="4" fill="#06b6d4" />
      <text x="197" y="134" fill="#000" fontSize="8.5" fontWeight="900" textAnchor="middle">IDX</text>

      {/* Row 3: name */}
      <line x1="25" y1="192" x2="230" y2="192" stroke="#263147" strokeWidth="1" />
      <text x="40" y="178" fill="#94a3b8" fontSize="10.5" fontFamily="monospace">string</text>
      <text x="95" y="178" fill="#f1f5f9" fontSize="11" fontWeight="600">name</text>

      {/* Row 4: picture */}
      <line x1="25" y1="236" x2="230" y2="236" stroke="#263147" strokeWidth="1" />
      <text x="40" y="222" fill="#94a3b8" fontSize="10.5" fontFamily="monospace">string</text>
      <text x="95" y="222" fill="#f1f5f9" fontSize="11" fontWeight="600">picture</text>

      {/* Row 5: createdAt */}
      <text x="40" y="266" fill="#94a3b8" fontSize="10" fontFamily="monospace">datetime</text>
      <text x="100" y="266" fill="#f1f5f9" fontSize="11" fontWeight="600">createdAt</text>
    </g>

    {/* Relationship Connector Line (Crow's Foot) */}
    <g>
      <line x1="230" y1="90" x2="310" y2="90" stroke="#818cf8" strokeWidth="2" />
      {/* 1 marker (USER side) */}
      <line x1="242" y1="83" x2="242" y2="97" stroke="#818cf8" strokeWidth="2" />
      <line x1="248" y1="83" x2="248" y2="97" stroke="#818cf8" strokeWidth="2" />

      {/* N / Crow's foot (DOCUMENT side) */}
      <path d="M 298 83 L 310 90 L 298 97" fill="none" stroke="#818cf8" strokeWidth="2" />
      <circle cx="292" cy="90" r="4" fill="none" stroke="#818cf8" strokeWidth="1.6" />

      {/* Badge in middle */}
      <rect x="250" y="105" width="44" height="18" rx="4" fill="#1e293b" stroke="#6c63ff" strokeWidth="1" />
      <text x="272" y="118" fill="#a78bfa" fontSize="9" fontWeight="700" textAnchor="middle">owns</text>
    </g>

    {/* Table 2: DOCUMENT Collection */}
    <g>
      {/* Container & Header */}
      <rect x="310" y="28" width="205" height="278" rx="8" fill="#161b27" stroke="#334155" strokeWidth="1.5" />
      <rect x="310" y="28" width="205" height="36" rx="8" fill="url(#erHeadDoc)" />
      <rect x="310" y="56" width="205" height="8" fill="url(#erHeadDoc)" />
      <text x="412" y="51" fill="#fff" fontSize="12" fontWeight="800" textAnchor="middle">DOCUMENT (Collection)</text>

      {/* Row 1: id */}
      <line x1="310" y1="94" x2="515" y2="94" stroke="#263147" strokeWidth="1" />
      <text x="325" y="82" fill="#94a3b8" fontSize="10.5" fontFamily="monospace">string</text>
      <text x="375" y="82" fill="#f1f5f9" fontSize="11" fontWeight="700">id</text>
      <rect x="470" y="72" width="30" height="17" rx="4" fill="#f59e0b" />
      <text x="485" y="84" fill="#000" fontSize="9" fontWeight="900" textAnchor="middle">PK</text>

      {/* Row 2: userId */}
      <line x1="310" y1="138" x2="515" y2="138" stroke="#263147" strokeWidth="1" />
      <text x="325" y="126" fill="#94a3b8" fontSize="10.5" fontFamily="monospace">string</text>
      <text x="375" y="126" fill="#f1f5f9" fontSize="11" fontWeight="700">userId</text>
      <rect x="470" y="116" width="30" height="17" rx="4" fill="#8b5cf6" />
      <text x="485" y="128" fill="#fff" fontSize="9" fontWeight="900" textAnchor="middle">FK</text>

      {/* Row 3: title */}
      <line x1="310" y1="182" x2="515" y2="182" stroke="#263147" strokeWidth="1" />
      <text x="325" y="170" fill="#94a3b8" fontSize="10.5" fontFamily="monospace">string</text>
      <text x="375" y="170" fill="#f1f5f9" fontSize="11" fontWeight="600">title</text>

      {/* Row 4: content */}
      <line x1="310" y1="226" x2="515" y2="226" stroke="#263147" strokeWidth="1" />
      <text x="325" y="214" fill="#94a3b8" fontSize="10.5" fontFamily="monospace">string</text>
      <text x="375" y="214" fill="#f1f5f9" fontSize="11" fontWeight="600">content</text>

      {/* Row 5: theme */}
      <line x1="310" y1="270" x2="515" y2="270" stroke="#263147" strokeWidth="1" />
      <text x="325" y="256" fill="#94a3b8" fontSize="10.5" fontFamily="monospace">string</text>
      <text x="375" y="256" fill="#f1f5f9" fontSize="11" fontWeight="600">theme</text>

      {/* Row 6: pageSize */}
      <text x="325" y="294" fill="#94a3b8" fontSize="10.5" fontFamily="monospace">string</text>
      <text x="375" y="294" fill="#f1f5f9" fontSize="11" fontWeight="600">pageSize</text>
    </g>
  </svg>
);

/* ── 4. Mindmap Vector SVG ── */
const MindmapVisual: FC = () => (
  <svg viewBox="0 0 640 330" className="lp-vector-diagram-svg" aria-label="Mindmap Strategy Vector Preview">
    <defs>
      <radialGradient id="mmHubGrad" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#8b5cf6" />
        <stop offset="100%" stopColor="#4f46e5" />
      </radialGradient>
      <filter id="mmGlow" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="5" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>

    <rect x="0" y="0" width="640" height="330" rx="12" fill="#0d121c" />

    {/* Connecting Splines from Center to Branch Hubs */}
    <path d="M 276 165 C 255 120, 245 77, 280 77" fill="none" stroke="#8b5cf6" strokeWidth="2.2" />
    <path d="M 276 165 C 255 210, 245 253, 285 253" fill="none" stroke="#10b981" strokeWidth="2.2" />
    <path d="M 364 165 L 372 165" fill="none" stroke="#06b6d4" strokeWidth="2.2" />

    {/* Splines from Core Engine Hub (180) to Left Leaves (150) */}
    <path d="M 180 77 C 165 77, 160 44, 150 44" fill="none" stroke="#a78bfa" strokeWidth="1.5" />
    <path d="M 180 77 L 150 80" fill="none" stroke="#a78bfa" strokeWidth="1.5" />
    <path d="M 180 77 C 165 77, 160 116, 150 116" fill="none" stroke="#a78bfa" strokeWidth="1.5" />

    {/* Splines from Document Vault Hub (180) to Left Leaves (150) */}
    <path d="M 180 253 C 165 253, 160 220, 150 220" fill="none" stroke="#34d399" strokeWidth="1.5" />
    <path d="M 180 253 L 150 256" fill="none" stroke="#34d399" strokeWidth="1.5" />
    <path d="M 180 253 C 165 253, 160 292, 150 292" fill="none" stroke="#34d399" strokeWidth="1.5" />

    {/* Splines from Print Geometry Hub (485) to Right Leaves (500) */}
    <path d="M 485 165 C 493 165, 495 127, 502 127" fill="none" stroke="#38bdf8" strokeWidth="1.5" />
    <path d="M 485 165 L 502 165" fill="none" stroke="#38bdf8" strokeWidth="1.5" />
    <path d="M 485 165 C 493 165, 495 203, 502 203" fill="none" stroke="#38bdf8" strokeWidth="1.5" />

    {/* ── Central Hub: MD2PDFX Platform ── */}
    <circle cx="320" cy="165" r="48" fill="url(#mmHubGrad)" filter="url(#mmGlow)" />
    <circle cx="320" cy="165" r="44" fill="#1e1b4b" stroke="#a78bfa" strokeWidth="2" />
    <text x="320" y="161" fill="#fff" fontSize="12" fontWeight="800" textAnchor="middle">MD2PDFX</text>
    <text x="320" y="176" fill="#a78bfa" fontSize="9.5" fontWeight="700" textAnchor="middle">Platform Hub</text>

    {/* ── Branch 1 Hub: Core Engine ── */}
    <rect x="180" y="62" width="105" height="30" rx="8" fill="#1e293b" stroke="#8b5cf6" strokeWidth="1.6" />
    <text x="232" y="81" fill="#c084fc" fontSize="11" fontWeight="700" textAnchor="middle">Core Engine</text>
    {/* Leaves (x: 15..150) */}
    <rect x="25" y="32" width="125" height="24" rx="5" fill="#161b27" stroke="#475569" strokeWidth="1" />
    <text x="87" y="48" fill="#cbd5e1" fontSize="9.5" fontWeight="600" textAnchor="middle">Puppeteer Engine</text>

    <rect x="25" y="68" width="125" height="24" rx="5" fill="#161b27" stroke="#475569" strokeWidth="1" />
    <text x="87" y="84" fill="#cbd5e1" fontSize="9.5" fontWeight="600" textAnchor="middle">Vector SVG Crisp</text>

    <rect x="15" y="104" width="135" height="24" rx="5" fill="#161b27" stroke="#475569" strokeWidth="1" />
    <text x="82" y="120" fill="#cbd5e1" fontSize="9.5" fontWeight="600" textAnchor="middle">Smart Page Breaks</text>

    {/* ── Branch 2 Hub: Document Vault ── */}
    <rect x="180" y="238" width="115" height="30" rx="8" fill="#064e3b" stroke="#10b981" strokeWidth="1.6" />
    <text x="237" y="257" fill="#34d399" fontSize="11" fontWeight="700" textAnchor="middle">Document Vault</text>
    {/* Leaves (x: 10..150) */}
    <rect x="10" y="208" width="140" height="24" rx="5" fill="#161b27" stroke="#475569" strokeWidth="1" />
    <text x="80" y="224" fill="#cbd5e1" fontSize="9.5" fontWeight="600" textAnchor="middle">Google 1-Click OAuth</text>

    <rect x="10" y="244" width="140" height="24" rx="5" fill="#161b27" stroke="#475569" strokeWidth="1" />
    <text x="80" y="260" fill="#cbd5e1" fontSize="9.5" fontWeight="600" textAnchor="middle">MongoDB Atlas Sync</text>

    <rect x="20" y="280" width="130" height="24" rx="5" fill="#161b27" stroke="#475569" strokeWidth="1" />
    <text x="85" y="296" fill="#cbd5e1" fontSize="9.5" fontWeight="600" textAnchor="middle">Live Secret Links</text>

    {/* ── Branch 3 Hub: Print Geometry ── */}
    <rect x="372" y="150" width="115" height="30" rx="8" fill="#082f49" stroke="#06b6d4" strokeWidth="1.6" />
    <text x="429" y="169" fill="#38bdf8" fontSize="11" fontWeight="700" textAnchor="middle">Print Geometry</text>
    {/* Leaves (x: 502..630) */}
    <rect x="502" y="115" width="128" height="24" rx="5" fill="#161b27" stroke="#475569" strokeWidth="1" />
    <text x="566" y="131" fill="#cbd5e1" fontSize="9.5" fontWeight="600" textAnchor="middle">A3 / A4 / A5 Sizes</text>

    <rect x="502" y="153" width="128" height="24" rx="5" fill="#161b27" stroke="#475569" strokeWidth="1" />
    <text x="566" y="169" fill="#cbd5e1" fontSize="9.5" fontWeight="600" textAnchor="middle">US Letter &amp; Legal</text>

    <rect x="502" y="191" width="128" height="24" rx="5" fill="#161b27" stroke="#475569" strokeWidth="1" />
    <text x="566" y="207" fill="#cbd5e1" fontSize="9.5" fontWeight="600" textAnchor="middle">4-Sided MM Margins</text>
  </svg>
);

export const MermaidShowcaseSection: FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<DiagramTab>(DIAGRAM_TABS[0]);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard.writeText(activeTab.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenEditor = () => {
    navigate('/editor', { state: { initialMarkdown: activeTab.code } });
  };

  return (
    <section id="lp-diagrams" className="lp-section lp-diagrams-section">
      <div className="lp-section-inner">
        {/* Header */}
        <div className="lp-section-header text-center mb-5">
          <span className="lp-section-label lp-section-label--center">DIAGRAMS AS CODE</span>
          <h2 className="lp-section-title">
            Render Architecture &amp; System Diagrams in Flawless Vector
          </h2>
          <p className="lp-section-desc mx-auto">
            Say goodbye to blurry screenshot tools. Write sequence flows, cloud architectures, database schemas, and mindmaps directly in your Markdown with instant vector SVG rendering.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="lp-diag-tabs-wrapper">
          <div className="lp-diag-tabs" role="tablist">
            {DIAGRAM_TABS.map((tab) => {
              const active = tab.id === activeTab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={`lp-diag-tab-btn ${active ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab)}
                >
                  <i className={`bi ${tab.icon}`} />
                  <span className="lp-diag-tab-label">{tab.label}</span>
                  <span className="lp-diag-tab-badge">{tab.badge}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Interactive Showcase Card */}
        <div className="lp-diag-showcase-card">
          <div className="lp-diag-card-topbar">
            <div className="lp-diag-topbar-info">
              <span className="lp-diag-chip-accent">{activeTab.badge}</span>
              <h3 className="lp-diag-card-title">{activeTab.title}</h3>
            </div>
            <div className="lp-diag-topbar-actions">
              <button
                type="button"
                className="lp-diag-btn-copy"
                onClick={handleCopy}
                title="Copy diagram syntax"
              >
                <i className={`bi ${copied ? 'bi-check2' : 'bi-clipboard'}`} />
                <span>{copied ? 'Copied!' : 'Copy Code'}</span>
              </button>
              <button
                type="button"
                className="lp-diag-btn-cta"
                onClick={handleOpenEditor}
              >
                <span>Open in Editor</span>
                <i className="bi bi-arrow-right" />
              </button>
            </div>
          </div>

          <div className="lp-diag-split-view">
            {/* Left: Code Pane */}
            <div className="lp-diag-code-pane">
              <div className="lp-diag-pane-header">
                <span className="lp-pane-tag"><i className="bi bi-code-slash" /> Markdown Source</span>
                <span className="lp-pane-pill">Mermaid v11</span>
              </div>
              <div className="lp-diag-code-body">
                <pre>
                  <code>
                    {activeTab.code.split('\n').map((line, idx) => (
                      <div key={idx} className="lp-code-line">
                        <span className="lp-line-num">{idx + 1}</span>
                        <span className="lp-line-text">{line}</span>
                      </div>
                    ))}
                  </code>
                </pre>
              </div>
            </div>

            {/* Right: Visual SVG Preview Pane */}
            <div className="lp-diag-preview-pane">
              <div className="lp-diag-pane-header">
                <span className="lp-pane-tag"><i className="bi bi-vector-pen" /> Vector PDF Render</span>
                <span className="lp-pane-pill lp-pill-vector">
                  <i className="bi bi-check-circle-fill me-1" /> 100% Vector SVG
                </span>
              </div>
              <div className="lp-diag-preview-content">
                {activeTab.id === 'sequence' && <SequenceVisual />}
                {activeTab.id === 'flowchart' && <FlowchartVisual />}
                {activeTab.id === 'er' && <ErVisual />}
                {activeTab.id === 'mindmap' && <MindmapVisual />}
              </div>
            </div>
          </div>

          {/* Feature Highlights Footer */}
          <div className="lp-diag-card-footer">
            <div className="lp-diag-feat-item">
              <i className="bi bi-lightning-charge-fill text-warning" />
              <span><strong>Unfenced Auto-Detection:</strong> Paste diagrams directly with or without backticks.</span>
            </div>
            <div className="lp-diag-feat-item">
              <i className="bi bi-moon-stars-fill text-primary" />
              <span><strong>Dark &amp; Light Adaptive:</strong> Node colors adjust to match your chosen document theme.</span>
            </div>
            <div className="lp-diag-feat-item">
              <i className="bi bi-check-circle-fill text-success" />
              <span><strong>Publication Grade:</strong> Sharp vector curves at 400% zoom with zero blurriness.</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default MermaidShowcaseSection;
