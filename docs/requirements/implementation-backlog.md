# Implementation backlog

1. **Page structure:** implement semantic page sections and navigation from the copy. Done when every section has a place and reading order works without CSS.
2. **Responsive presentation:** translate the layout notes in site-copy.md into the repository's chosen stack. Done after mobile/desktop overflow, spacing, and keyboard checks.
3. **Content/config:** centralize product names, status labels, and outbound destinations. Done when unavailable destinations cannot produce broken CTAs.
4. **Metadata and assets:** add approved title/description/canonical/social metadata and brand assets. Done when no placeholder URLs or invented assets remain.
5. **Review and release:** verify copy, product status, accessibility, and hosting. Publish only to the chosen company destination.

The backend is the CRV app's (Amplify Gen 2, us-east-2); it holds interest, invitations, grants and Activity, and later
CRM, licensing and billing as their own areas (ADR 0001). *Until 2026-10-04 this read:* No product integration backend
is required. No existing implementation is assumed.
