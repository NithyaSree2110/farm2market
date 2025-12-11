import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Header } from '@/components/Header';
import { AgriBuddy } from '@/components/AgriBuddy';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { Search, MapPin, Package } from 'lucide-react';

interface Crop {
  id: string;
  name: string;
  description: string;
  price_per_kg: number;
  quantity_kg: number;
  image_url: string | null;
  location: string | null;
  farmer_id: string;
  // translations stored as JSON in DB
  name_translations?: Record<string, string | null> | null;
  description_translations?: Record<string, string | null> | null;
  location_translations?: Record<string, string | null> | null;
  farmer_name?: string | null;
}

export default function Marketplace() {
  const [crops, setCrops] = useState<Crop[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, language } = useLanguage(); // language contains 'en','hi','te','kn', etc.

  useEffect(() => {
    fetchCrops();
  }, [language]); // refetch or at least re-render if language changes
  const attachFarmerNamesAndSet = async (rawCrops: any[]) => {
  // normalizedCrop shape will match Crop interface
  const typedCrops = rawCrops.map((c: any) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    price_per_kg: c.price_per_kg,
    quantity_kg: c.quantity_kg,
    image_url: c.image_url ?? null,
    location: c.location ?? null,
    farmer_id: c.farmer_id,
    name_translations: c.name_translations ?? null,
    description_translations: c.description_translations ?? null,
    location_translations: c.location_translations ?? null,
    farmer_name: null,
  })) as Crop[];

  // fetch farmer profiles only if there are farmer_ids
  const farmerIds = Array.from(new Set(typedCrops.map(c => c.farmer_id).filter(Boolean)));
  if (farmerIds.length > 0) {
    const { data: profilesRaw, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .in('id', farmerIds);

    if (!profilesError && profilesRaw) {
      const profileMap = new Map<string, any>();
      (profilesRaw as any[]).forEach(p => profileMap.set(p.id, p));
      typedCrops.forEach(c => {
        const p = profileMap.get(c.farmer_id);
        const name = p?.name ?? p?.full_name ?? (p?.first_name && p?.last_name ? `${p.first_name} ${p.last_name}` : p?.display_name) ?? null;
        c.farmer_name = name;
      });
    } else {
      console.warn('profiles fetch error', profilesError);
    }
  }

  setCrops(typedCrops);
  setLoading(false);
};

  const fetchCrops = async () => {
  try {
    // Attempt to fetch including translation columns (if they exist)
    const { data, error } = await supabase
      .from('crops')
      .select(`
        id,
        name,
        description,
        price_per_kg,
        quantity_kg,
        image_url,
        location,
        farmer_id,
        name_translations,
        description_translations,
        location_translations
      `)
      .eq('available', true)
      .order('created_at', { ascending: false });

    if (error) {
      // If the error indicates missing columns, re-fetch without translations
      console.warn('fetchCrops initial query error:', error.message || error);
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('crops')
        .select('id, name, description, price_per_kg, quantity_kg, image_url, location, farmer_id')
        .eq('available', true)
        .order('created_at', { ascending: false });

      if (fallbackError) throw fallbackError;

      // Normalize: attach null translations
      const normalized = (fallbackData || []).map((c: any) => ({
        ...c,
        name_translations: null,
        description_translations: null,
        location_translations: null,
      }));

      await attachFarmerNamesAndSet(normalized);
      return;
    }

    // If original query succeeded, ensure data is typed as any[] then normalize
    const cropsWithMaybeTranslations = (data || []) as any[];
    await attachFarmerNamesAndSet(cropsWithMaybeTranslations);
  } catch (err: any) {
    console.error('Fetch crops error:', err);
    toast({
      title: 'Error',
      description: err.message || String(err),
      variant: 'destructive',
    });
    setLoading(false);
  }
};


  const getTranslated = (translations: Record<string, string | null> | undefined | null, original: string) => {
    if (!translations) return original;
    const val = translations[language] ?? translations['en'] ?? null;
    return val ?? original;
  };

  const filteredCrops = crops.filter(crop =>
    (getTranslated(crop.name_translations, crop.name).toLowerCase().includes(searchTerm.toLowerCase())) ||
    (getTranslated(crop.location_translations, crop.location || '').toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-gradient-warm">
      <Header />
      <div className="container py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-primary bg-clip-text text-transparent">
            {t('marketplace')}
          </h1>
          <p className="text-muted-foreground">{t('tagline')}</p>
        </div>

        <div className="mb-6 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
          <Input
            placeholder={t('search')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {loading ? (
          <div className="text-center py-12">{t('loading')}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCrops.map((crop) => (
              <Card key={crop.id} className="overflow-hidden hover:shadow-medium transition-shadow">
                <CardHeader className="p-0">
                  <div className="h-48 bg-gradient-to-br from-primary-light to-primary relative overflow-hidden">
                    {crop.image_url ? (
                      <img
                        src={crop.image_url}
                        alt={getTranslated(crop.name_translations, crop.name)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <span className="text-6xl">🌾</span>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  <CardTitle className="mb-2">{getTranslated(crop.name_translations, crop.name)}</CardTitle>
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {getTranslated(crop.description_translations, crop.description)}
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-2xl">💰</span>
                      <span className="font-semibold text-primary text-lg">
                        ₹{crop.price_per_kg}/{t('quantity')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Package className="h-4 w-4" />
                      <span>{crop.quantity_kg} kg available</span>
                    </div>
                    {crop.location && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span>{getTranslated(crop.location_translations, crop.location)}</span>
                      </div>
                    )}
                    {crop.farmer_name && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="text-xl">👩‍🌾</span>
                        <span>{crop.farmer_name}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="p-4 pt-0">
                  <Button
                    onClick={() => navigate(`/crop/${crop.id}`)}
                    className="w-full bg-gradient-primary"
                  >
                    {t('buyNow')}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}

        {!loading && filteredCrops.length === 0 && (
          <div className="text-center py-12">
            <span className="text-6xl block mb-4">🌾</span>
            <p className="text-muted-foreground">No crops found</p>
          </div>
        )}
      </div>
      <AgriBuddy />
    </div>
  );
}
