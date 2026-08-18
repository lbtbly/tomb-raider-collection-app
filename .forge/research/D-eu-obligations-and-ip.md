# Scout D: EU obligations and the trademark question

Verified 2026-08-17 against primary sources. The compliance skill file is not cited
as authority anywhere below.

## FIRES

### GDPR, Regulation (EU) 2016/679, full baseline

Accounts, emails, uploaded photos, and collection records are personal data under
Art. 4(1).

- Lawful basis: contract, Art. 6(1)(b), for account and collection functionality.
  Consent, Art. 6(1)(a), for anything non-essential.
- **Purchase price of a hobby item is ordinary personal data, not a special
  category under Art. 9.** It reveals a collecting hobby, not health, religion, or
  sexuality. Do not over-engineer this.
- **User-uploaded photos are the real risk vector.** If a photo incidentally
  captures another identifiable person, GDPR still attaches (Art. 4(1), recital 26).
  The upload flow needs a "your photo, your items only" prompt and a report path,
  not a policy paragraph.

Artifacts: a privacy notice naming the basis per purpose; a working export and an
account deletion captured in a real session; a stated retention schedule per table
and column; DPAs with every processor (host, email, auth, object storage) per
Art. 28, with EU or adequate-country residency documented.

https://eur-lex.europa.eu/eli/reg/2016/679/oj
https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines_en
https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/adequacy-decisions_en

### Cookie and consent, ePrivacy Art. 5(3) as nationally implemented

Fires only if non-essential storage is used.

**Digital Omnibus status: still in trilogue.** The Council's June 2026 compromise
text dropped single-click rejection, the re-ask moratorium, and binding
browser-signal recognition. Nothing there is law. Build against current ePrivacy
law, not the proposal.
https://www.taylorwessing.com/en/global-data-hub/2026/the-digital-omnibus-proposal/gdh---the-digital-omnibus---cookies
https://eur-lex.europa.eu/legal-content/EN/HIS/?uri=COM:2025:0592

**A lawful zero-banner path exists.** Strictly-necessary cookies only (session and
auth), plus first-party cookieless analytics that sets no identifier and does no
fingerprinting. Plausible (self- or EU-hosted) and Fathom are the products DPAs
have repeatedly accepted as outside consent scope when configured cookieless.
CNIL's exemption guidance permits analytics only under narrow conditions: no
cross-site tracking, anonymized and aggregated, no persistent identifier.
https://www.cnil.fr/en/cookies-and-other-tracking-devices/rules/cookies-solutions-are-exempted-consent

Add any third-party SDK (crash reporting, ads, non-cookieless analytics) and the
banner returns: reject as easy as accept, nothing fires before the choice.

Artifact: a network capture on first load showing zero non-essential requests, plus
a capture of the reject path if a banner exists at all.

### Digital Services Act, Regulation (EU) 2022/2065, irreducible minimum

This is a hosting service carrying user-generated content, so **Art. 16
(notice-and-action for illegal content) and Art. 17 (statement of reasons on
removal or restriction) apply regardless of size.** Those sit in Section 2, which
Art. 19's micro and small exemption does not reach.

As a single-operator EU platform this qualifies as a micro or small enterprise
under Recommendation 2003/361/EC (fewer than 10 staff, under EUR 2M turnover),
which under Art. 19 exempts it from Section 3: no internal complaint-handling
system (Art. 20), no out-of-court dispute settlement (Art. 21), no trusted-flagger
prioritization (Art. 22), no transparency reporting (Art. 24), **except Art. 24(3),
which still requires publishing average monthly active recipients.**

Artifact: a report-content button wired to a notice mechanism carrying Art. 16(2)'s
required fields, a stated moderation response in the terms, and a removal-notice
template satisfying Art. 17.

https://eur-lex.europa.eu/eli/reg/2022/2065/oj/eng

## DOES NOT FIRE

### European Accessibility Act, Directive (EU) 2019/882: out of scope

In force since 28 June 2025. Scope is not "any consumer digital service." Art. 2
and Annex I Section IV enumerate covered services: e-commerce, consumer banking,
e-books, air/bus/rail/waterborne transport information and ticketing, electronic
communications, audiovisual media access services. **A free, non-transactional
collection tracker with no money changing hands falls into none of them**, so it is
outside Art. 2 on its face. The microenterprise exemption (Art. 4(5)) is a fallback
if scope were ever contested, but scope is the cleaner answer.

WCAG 2.1 AA (the substance of EN 301 549, the harmonized standard) stays as a
**voluntary design-quality floor**, held by the standards skill, not as a Release
line legal obligation.

https://eur-lex.europa.eu/eli/dir/2019/882/oj
https://www.etsi.org/deliver/etsi_en/301500_301599/301549/

### Cyber Resilience Act: date confirmed, product out of scope

The 11 September 2026 date is correct and unchanged: early warning within 24h,
notification within 72h, final report within 14 days for a vulnerability and one
month for a severe incident, filed through ENISA's Single Reporting Platform.

**But the Commission's March 2026 guidance is explicit**: software that executes
remotely and is accessed only through a browser is not, on that basis, a product
with digital elements. Pure SaaS and web apps are out of scope unless they are a
remote data processing solution that a separate manufactured product cannot
function without (recital 12). This app is a standalone browser-only web service
with no companion hardware or downloadable client, so it fails the RDPS test.
**No SBOM or CSIRT reporting obligation fires.** Revisit the instant a native
companion app or downloadable component ships.

https://digital-strategy.ec.europa.eu/en/policies/cra-summary
https://www.cyberresilienceact.eu/commission-guidance.html
https://www.dlapiper.com/en/insights/publications/2026/02/cyber-resilience-act-the-fine-line-between-saas-and-digital-products

## DATES TO WATCH

- **28 June 2025**: EAA in force. Already passed. Confirms a current non-obligation,
  not a future one.
- **11 September 2026**: CRA reporting begins. Irrelevant to this architecture,
  relevant instantly if a downloadable client ever ships.
- **Ongoing, unresolved**: Digital Omnibus trilogue. Do not build against proposed
  Art. 88a/88b until adopted and in force.
- **2 December 2026**: AI Act generative-content marking. Irrelevant unless
  AI-generated imagery is added.

## IP SECTION

### Nominative fair use

EU trademark law (Directive (EU) 2015/2436 Art. 14(1)(c), and Regulation (EU)
2017/1001 Art. 14 for EU-wide marks) permits use of another's mark "for the purpose
of identifying or referring to goods or services as those of the proprietor,"
provided the use accords with honest practices. The app **can and must** use the
words "Tomb Raider" and "Lara Croft" descriptively to identify what the catalogue
covers. It **cannot** use them as its own brand identity in a way implying
sponsorship.

Concretely: give the product a name that does not carry the mark, which also serves
the brief's own constraint that this generalize to other franchises later. Put
"Tomb Raider" and "Lara Croft" only in descriptive copy. **A domain containing the
mark raises confusion risk under Art. 9 infringement standards even with a
disclaimer.** A mark-free domain with the franchise name only in on-page copy is
materially safer, and matches how every surveyed comparable operates.

https://eur-lex.europa.eu/eli/dir/2015/2436/oj

### Facts vs the sui generis database right

Item titles, release years, box variants, and other factual attributes are not
protected by copyright, and reproducing them from public sources does not infringe
another database's sui generis right under Directive 96/9/EC unless you extract or
re-utilize a substantial part of someone else's compiled database (scraping a
wiki's whole dataset, for instance). **Building the catalogue from public facts you
compile yourself creates no exposure**, and the finished catalogue becomes
protectable in your favour after substantial investment.

https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:31996L0009

### Images

Box art, packaging photography, promotional stills, and official logos are
copyrighted works. **Do not ship official Crystal Dynamics, Embracer, or Square
Enix imagery, ever, at any size.** The safe and sufficient path: catalogue entries
are text-first (title, release info, category), and item images come from users'
own photographs of their physical items, which they own as photographers. This also
matches the collector-authenticity feel the brief asks for.

### What comparable fan databases actually do

Discogs and Brickset both run on user-contributed photographs of physical items
rather than official promotional art, both carry conspicuous unofficial and fan
disclaimers, and both name the franchise only descriptively, never in the primary
brand mark. MyFigureCollection is entirely user-photo driven. Bulbapedia and the
Tomb Raider fan wikis do use official art under a claimed fair-use rationale
specific to editorial reference wikis, which is weaker and more US-centric than
what an EU-hosted catalogue should rely on. **Mirror Discogs and Brickset, not the
wikis.**

### Realistic takedown risk

Square Enix and Embracer have issued DMCA notices for leaked content (scripts,
unreleased assets), but there is a documented, long-running Official Fansite
Program for Tomb Raider fan sites and a tolerated ecosystem of fan wikis and
archives operating for years without action. The enforcement pattern is tolerant of
non-commercial, clearly disclaimed fan projects and hostile to leaks and commercial
infringement.

Build the takedown path regardless: a visible "Report a rights issue" contact, a
named response commitment, and a documented removal procedure, **wired into the
same mechanism as the DSA Art. 16 notice-and-action button so it is one system, not
two.**

https://www.wikiraider.com/index.php/Official_Fansite_Program_Websites

### Concrete recommendation

1. Name the product without the mark in brand or domain.
2. A persistent one-line disclaimer in the footer and on About: "Fan-made and
   unofficial. Not affiliated with, endorsed by, or sponsored by Crystal Dynamics,
   Embracer Group, or their licensors. Tomb Raider and Lara Croft are trademarks of
   their respective owners."
3. Zero official art. Text-first catalogue entries. User-photographed collection
   images only.
4. Run the rights-takedown path through the same Art. 16 notice mechanism the DSA
   already requires.
