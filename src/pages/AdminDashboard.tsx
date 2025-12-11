import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Header } from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Users, Sprout, Package, Shield, Edit, Trash2, PlusCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Profile {
  id: string;
  phone: string | null;
  role: string;
  name?: string | null;
}

interface Crop {
  id: string;
  name: string;
  price_per_kg: number;
  quantity_kg: number;
  farmer_id: string;
  available?: boolean;
}

interface Order {
  id: string;
  buyer_id: string;
  farmer_id: string;
  crop_id: string;
  total_price: number;
  status: string;
  quantity_kg: number;
}

export default function AdminDashboard() {
  const { user, userRole, loading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && (!user || userRole !== 'admin')) {
      navigate('/auth');
    }
  }, [user, userRole, loading, navigate]);

  useEffect(() => {
    if (user && userRole === 'admin') {
      fetchData();
    }
  }, [user, userRole]);

  const fetchData = async () => {
    setBusy(true);
    try {
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, phone, role, name')
        .limit(200);
      if (profilesError) throw profilesError;
      setProfiles((profilesData as Profile[]) || []);

      const { data: cropsData, error: cropsError } = await supabase
        .from('crops')
        .select('id, name, price_per_kg, quantity_kg, farmer_id, available')
        .limit(200);
      if (cropsError) throw cropsError;
      setCrops((cropsData as Crop[]) || []);

      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('id, buyer_id, farmer_id, crop_id, total_price, status, quantity_kg')
        .order('created_at', { ascending: false })
        .limit(200);
      if (ordersError) throw ordersError;
      setOrders((ordersData as Order[]) || []);
    } catch (err: any) {
      console.error('Admin fetchData error', err);
      toast({
        title: t('error') || 'Error',
        description: err?.message ?? String(err),
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  /* ---------- Profiles (Users) CRUD ---------- */

  const createProfile = async () => {
    const phone = window.prompt('Phone (include country code, e.g. +919876543210):')?.trim();
    if (!phone) return;
    const name = window.prompt('Name (optional):')?.trim() || null;
    const role = window.prompt('Role (admin / farmer / buyer):', 'farmer')?.trim() || 'farmer';

    setBusy(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .insert([{ phone, name, role }]);
      if (error) throw error;
      toast({ title: 'Profile created' });
      fetchData();
    } catch (err: any) {
      console.error('createProfile error', err);
      toast({
        title: 'Error creating profile',
        description: err?.message ?? String(err),
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const editProfile = async (p: Profile) => {
    const newPhone = window.prompt('Phone:', p.phone ?? '')?.trim();
    if (newPhone === null) return; // user cancelled
    const newName = window.prompt('Name:', p.name ?? '')?.trim();
    if (newName === null) return;
    const newRole = window.prompt('Role (admin / farmer / buyer):', p.role)?.trim();
    if (newRole === null) return;

    setBusy(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ phone: newPhone || null, name: newName || null, role: newRole })
        .eq('id', p.id);
      if (error) throw error;
      toast({ title: 'Profile updated' });
      fetchData();
    } catch (err: any) {
      console.error('editProfile error', err);
      toast({
        title: 'Error updating profile',
        description: err?.message ?? String(err),
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const deleteProfile = async (p: Profile) => {
    if (!confirm(`Delete profile ${p.id.slice(0, 8)}...? This removes only the profiles row.`)) return;

    setBusy(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', p.id);
      if (error) throw error;
      toast({ title: 'Profile deleted' });
      fetchData();
    } catch (err: any) {
      console.error('deleteProfile error', err);
      toast({
        title: 'Error deleting profile',
        description: err?.message ?? String(err),
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  /* ---------- Crops CRUD ---------- */

  const createCrop = async () => {
    const name = window.prompt('Crop name:')?.trim();
    if (!name) return;
    const priceStr = window.prompt('Price per kg (number):', '0')?.trim();
    if (priceStr === null) return;
    const quantityStr = window.prompt('Quantity (kg):', '0')?.trim();
    if (quantityStr === null) return;
    const farmerId = window.prompt('Farmer profile id: (must match profiles.id)')?.trim();
    if (!farmerId) return;

    const price = parseFloat(priceStr) || 0;
    const quantity = parseFloat(quantityStr) || 0;

    setBusy(true);
    try {
      const { error } = await supabase
        .from('crops')
        .insert([{ name, price_per_kg: price, quantity_kg: quantity, farmer_id: farmerId, available: true }]);
      if (error) throw error;
      toast({ title: 'Crop created' });
      fetchData();
    } catch (err: any) {
      console.error('createCrop error', err);
      toast({
        title: 'Error creating crop',
        description: err?.message ?? String(err),
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const editCrop = async (c: Crop) => {
    const newName = window.prompt('Crop name:', c.name) ?? c.name;
    const newPriceStr = window.prompt('Price per kg:', String(c.price_per_kg));
    if (newPriceStr === null) return;
    const newQtyStr = window.prompt('Quantity (kg):', String(c.quantity_kg));
    if (newQtyStr === null) return;
    const newAvailableStr = window.prompt('Available? (yes/no):', c.available ? 'yes' : 'no');
    if (newAvailableStr === null) return;

    const newPrice = parseFloat(newPriceStr) || 0;
    const newQty = parseFloat(newQtyStr) || 0;
    const newAvailable = (newAvailableStr.toLowerCase() === 'yes');

    setBusy(true);
    try {
      const { error } = await supabase
        .from('crops')
        .update({ name: newName, price_per_kg: newPrice, quantity_kg: newQty, available: newAvailable })
        .eq('id', c.id);
      if (error) throw error;
      toast({ title: 'Crop updated' });
      fetchData();
    } catch (err: any) {
      console.error('editCrop error', err);
      toast({
        title: 'Error updating crop',
        description: err?.message ?? String(err),
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const deleteCrop = async (c: Crop) => {
    if (!confirm(`Delete crop "${c.name}"? This action cannot be undone.`)) return;

    setBusy(true);
    try {
      const { error } = await supabase
        .from('crops')
        .delete()
        .eq('id', c.id);
      if (error) throw error;
      toast({ title: 'Crop deleted' });
      fetchData();
    } catch (err: any) {
      console.error('deleteCrop error', err);
      toast({
        title: 'Error deleting crop',
        description: err?.message ?? String(err),
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  /* ---------- Render ---------- */

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">{t('loading')}</div>;
  }

  return (
    <div className="min-h-screen bg-amber-50">
      <Header />
      <div className="container py-8">
        <div className="mb-8 flex items-center gap-3">
          <Shield className="h-8 w-8 text-amber-600" />
          <div>
            <h1 className="text-4xl font-bold text-amber-800">
              {t('admin')} {t('dashboard')}
            </h1>
            <p className="text-amber-600">Admin CRUD panel</p>
          </div>
        </div>

        {/* Stats & create buttons */}
        <div className="flex items-center justify-between mb-6 gap-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1">
            <Card className="border-amber-200">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{t('users')}</CardTitle>
                <Users className="h-4 w-4 text-amber-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{profiles.length}</div>
              </CardContent>
            </Card>
            <Card className="border-amber-200">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{t('totalCrops')}</CardTitle>
                <Sprout className="h-4 w-4 text-amber-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{crops.length}</div>
              </CardContent>
            </Card>
            <Card className="border-amber-200">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{t('orders')}</CardTitle>
                <Package className="h-4 w-4 text-amber-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{orders.length}</div>
              </CardContent>
            </Card>
          </div>

          <div className="flex gap-2">
            <Button onClick={createProfile} className="flex items-center gap-2">
              <PlusCircle className="h-4 w-4" /> New User
            </Button>
            <Button onClick={createCrop} className="flex items-center gap-2">
              <PlusCircle className="h-4 w-4" /> New Crop
            </Button>
            <Button onClick={() => fetchData()} disabled={busy}>
              Reload
            </Button>
          </div>
        </div>

        {/* Users Table */}
        <Card className="mb-6 border-amber-200">
          <CardHeader>
            <CardTitle>{t('users')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Phone</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.phone || 'N/A'}</TableCell>
                    <TableCell>{p.name || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={p.role === 'admin' ? 'default' : 'secondary'}>
                        {p.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.id.slice(0, 8)}...</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => editProfile(p)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => deleteProfile(p)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Crops Table */}
        <Card className="mb-6 border-amber-200">
          <CardHeader>
            <CardTitle>{t('crops')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Price/kg</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Farmer ID</TableHead>
                  <TableHead>Available</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {crops.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.name}</TableCell>
                    <TableCell>₹{c.price_per_kg}</TableCell>
                    <TableCell>{c.quantity_kg} kg</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.farmer_id.slice(0, 8)}...</TableCell>
                    <TableCell>{c.available ? <Badge>Yes</Badge> : <Badge variant="secondary">No</Badge>}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => editCrop(c)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => deleteCrop(c)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Orders Table */}
        <Card className="border-amber-200">
          <CardHeader>
            <CardTitle>{t('orders')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Buyer</TableHead>
                  <TableHead>Farmer</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="text-xs">{o.id.slice(0, 8)}...</TableCell>
                    <TableCell className="text-xs">{o.buyer_id.slice(0, 8)}...</TableCell>
                    <TableCell className="text-xs">{o.farmer_id.slice(0, 8)}...</TableCell>
                    <TableCell>₹{o.total_price}</TableCell>
                    <TableCell>
                      <Badge>{o.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
