import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Header } from '@/components/Header';
import { AgriBuddy } from '@/components/AgriBuddy';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Plus, Edit, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const BUCKET_NAME = 'crop-images';

export default function MyCrops() {
  const [crops, setCrops] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [editingCrop, setEditingCrop] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const { user, profileId } = useAuth();
  // prefer profileId (typed). fallback to common user id shapes safely using any-cast
  const authUserId: string | null = (profileId as string) || ( (user as any)?.id ?? (user as any)?.uid ?? null );

  const { toast } = useToast();
  const { t } = useLanguage();

  useEffect(() => {
    if (user) fetchCrops();
  }, [user]);
// prefer profileId (typed); fallback to any-cast on user for legacy shape

  const fetchCrops = async () => {
    const { data } = await supabase
      .from('crops')
      .select('*')
      .eq('farmer_id', profileId || ((user as any)?.id ?? (user as any)?.uid))
      .order('created_at', { ascending: false });
    setCrops(data || []);
  };

  // Upload helper (returns public or signed URL)
  const handleImageUpload = async (file: File | null) => {
  if (!file || !authUserId) return null;

  setUploading(true);
  try {
    const fileExt = file.name.split('.').pop();
    const filePath = `${authUserId}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: publicData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    if (publicData?.publicUrl) return publicData.publicUrl;

    const { data: signedData } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(filePath, 60 * 60);

    return signedData?.signedUrl ?? null;
  } catch (error: any) {
    toast({
      title: 'Upload failed',
      description: error.message || String(error),
      variant: 'destructive',
    });
    console.error('Image upload error:', error);
    return null;
  } finally {
    setUploading(false);
  }
};


  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    // read file directly from FormData
    const imageEntry = formData.get('image');
    let imageFile: File | null = null;
    if (imageEntry instanceof File && imageEntry.size > 0) {
      imageFile = imageEntry;
    }

    let imageUrl = editingCrop?.image_url || null;
    if (imageFile) {
      const uploadedUrl = await handleImageUpload(imageFile);
      if (!uploadedUrl) return; // abort if upload failed
      imageUrl = uploadedUrl;
    }

    // Build translations JSON objects (en is original value)
    const name = (formData.get('name') as string)?.trim() || '';
    const description = (formData.get('description') as string)?.trim() || '';
    const location = (formData.get('location') as string)?.trim() || '';

    const name_translations = {
      en: name,
      hi: (formData.get('name_hi') as string)?.trim() || null,
      te: (formData.get('name_te') as string)?.trim() || null,
      kn: (formData.get('name_kn') as string)?.trim() || null,
    };

    const description_translations = {
      en: description,
      hi: (formData.get('description_hi') as string)?.trim() || null,
      te: (formData.get('description_te') as string)?.trim() || null,
      kn: (formData.get('description_kn') as string)?.trim() || null,
    };

    const location_translations = {
      en: location,
      hi: (formData.get('location_hi') as string)?.trim() || null,
      te: (formData.get('location_te') as string)?.trim() || null,
      kn: (formData.get('location_kn') as string)?.trim() || null,
    };

    // ensure farmer id is correct for RLS
    const farmerId = profileId ?? (user as any)?.id ?? (user as any)?.uid ?? null;
    if (!farmerId) {
      toast({
        title: 'Error',
        description: 'Unable to determine farmer id. Please re-login.',
        variant: 'destructive',
      });
      return;
    }

    const cropData: any = {
      name,
      description,
      price_per_kg: parseFloat(formData.get('price_per_kg') as string) || 0,
      quantity_kg: parseFloat(formData.get('quantity_kg') as string) || 0,
      location,
      image_url: imageUrl,
      farmer_id: farmerId,
      // store translation JSON; DB column type should be json/jsonb
      name_translations,
      description_translations,
      location_translations,
      available: true,
    };

    try {
      if (editingCrop) {
        const { error } = await supabase
          .from('crops')
          .update(cropData)
          .eq('id', editingCrop.id);
        if (error) throw error;
        toast({ title: 'Crop updated!' });
      } else {
        const { error } = await supabase
          .from('crops')
          .insert([cropData]);
        if (error) throw error;
        toast({ title: 'Crop added!' });
      }

      setIsOpen(false);
      setEditingCrop(null);
      fetchCrops();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || String(error),
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this crop?')) return;

    const { error } = await supabase
      .from('crops')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({ title: 'Crop deleted' });
      fetchCrops();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-warm">
      <Header />
      <div className="container py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              {t('myCrops')}
            </h1>
            <p className="text-muted-foreground mt-2">Manage your crop listings</p>
          </div>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary gap-2">
                <Plus className="h-4 w-4" />
                {t('addCrop')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingCrop ? t('edit') : t('addCrop')}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Crop Name (EN)</Label>
                  <Input
                    id="name"
                    name="name"
                    defaultValue={editingCrop?.name}
                    required
                  />
                </div>

                {/* Translation inputs (optional) */}
                <div className="grid md:grid-cols-3 gap-2">
                  <div>
                    <Label htmlFor="name_hi">Name (Hindi)</Label>
                    <Input id="name_hi" name="name_hi" defaultValue={editingCrop?.name_translations?.hi || ''} />
                  </div>
                  <div>
                    <Label htmlFor="name_te">Name (Telugu)</Label>
                    <Input id="name_te" name="name_te" defaultValue={editingCrop?.name_translations?.te || ''} />
                  </div>
                  <div>
                    <Label htmlFor="name_kn">Name (Kannada)</Label>
                    <Input id="name_kn" name="name_kn" defaultValue={editingCrop?.name_translations?.kn || ''} />
                  </div>
                </div>

                <div>
                  <Label htmlFor="description">Description (EN)</Label>
                  <Textarea
                    id="description"
                    name="description"
                    defaultValue={editingCrop?.description}
                    rows={3}
                  />
                </div>

                <div className="grid md:grid-cols-3 gap-2">
                  <div>
                    <Label htmlFor="description_hi">Description (Hindi)</Label>
                    <Textarea id="description_hi" name="description_hi" defaultValue={editingCrop?.description_translations?.hi || ''} rows={2} />
                  </div>
                  <div>
                    <Label htmlFor="description_te">Description (Telugu)</Label>
                    <Textarea id="description_te" name="description_te" defaultValue={editingCrop?.description_translations?.te || ''} rows={2} />
                  </div>
                  <div>
                    <Label htmlFor="description_kn">Description (Kannada)</Label>
                    <Textarea id="description_kn" name="description_kn" defaultValue={editingCrop?.description_translations?.kn || ''} rows={2} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="price_per_kg">Price per kg (₹)</Label>
                    <Input
                      id="price_per_kg"
                      name="price_per_kg"
                      type="number"
                      step="0.01"
                      defaultValue={editingCrop?.price_per_kg}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="quantity_kg">Quantity (kg)</Label>
                    <Input
                      id="quantity_kg"
                      name="quantity_kg"
                      type="number"
                      step="0.01"
                      defaultValue={editingCrop?.quantity_kg}
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="location">Location (EN)</Label>
                  <Input id="location" name="location" defaultValue={editingCrop?.location} />
                </div>

                <div className="grid md:grid-cols-3 gap-2">
                  <div>
                    <Label htmlFor="location_hi">Location (Hindi)</Label>
                    <Input id="location_hi" name="location_hi" defaultValue={editingCrop?.location_translations?.hi || ''} />
                  </div>
                  <div>
                    <Label htmlFor="location_te">Location (Telugu)</Label>
                    <Input id="location_te" name="location_te" defaultValue={editingCrop?.location_translations?.te || ''} />
                  </div>
                  <div>
                    <Label htmlFor="location_kn">Location (Kannada)</Label>
                    <Input id="location_kn" name="location_kn" defaultValue={editingCrop?.location_translations?.kn || ''} />
                  </div>
                </div>

                <div>
                  <Label htmlFor="image">Image</Label>
                  <Input
                    id="image"
                    name="image"
                    type="file"
                    accept="image/*"
                    disabled={uploading}
                  />
                </div>
                <Button type="submit" className="w-full bg-gradient-primary" disabled={uploading}>
                  {uploading ? 'Uploading...' : editingCrop ? t('save') : t('addCrop')}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          {crops.map((crop) => (
            <Card key={crop.id} className="overflow-hidden hover:shadow-medium transition-shadow">
              <CardHeader className="p-0">
                <div className="h-48 bg-gradient-to-br from-primary-light to-primary relative overflow-hidden">
                  {crop.image_url ? (
                    <img
                      src={crop.image_url}
                      alt={crop.name}
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
                <CardTitle className="mb-2">{crop.name}</CardTitle>
                <p className="text-sm text-muted-foreground mb-3">{crop.description}</p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingCrop(crop);
                      setIsOpen(true);
                    }}
                    className="flex-1"
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    {t('edit')}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(crop.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {crops.length === 0 && (
          <div className="text-center py-12">
            <span className="text-6xl block mb-4">🌾</span>
            <p className="text-muted-foreground mb-4">No crops listed yet</p>
            <Button onClick={() => setIsOpen(true)} className="bg-gradient-primary">
              {t('addCrop')}
            </Button>
          </div>
        )}
      </div>
      <AgriBuddy />
    </div>
  );
}
