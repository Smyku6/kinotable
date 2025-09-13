import "./globals.css";

export const metadata = {
    title: "Plan projekcji – kino",
    description: "Siatka sal × godzin wg seanse.json",
};


export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="pl" className="h-full">
        <body className="min-h-dvh bg-coal text-cream antialiased">
        {/* full-bleed */}
        <div className="w-full p-6">{children}</div>
        </body>
        </html>
    );
}