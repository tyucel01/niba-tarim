"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Group = {
  id: string;
  name: string;
  memberCount?: number;
};

export default function Page() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  async function loadGroups() {
    try {
      setLoading(true);

      const res = await fetch("/api/admin/whatsapp/groups", {
        cache: "no-store",
      });

      const data = await res.json();

      if (data.success) {
        setGroups(data.groups || []);
      }
    } finally {
      setLoading(false);
    }
  }

  async function createGroup() {
    if (!newName.trim()) return;

    try {
      setCreating(true);

      const res = await fetch("/api/admin/whatsapp/groups", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newName.trim(),
        }),
      });

      const data = await res.json();

      if (data.success) {
        setShowCreate(false);
        setNewName("");
        await loadGroups();
      }
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    loadGroups();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLocaleLowerCase("tr-TR");

    if (!q) return groups;

    return groups.filter((g) =>
      g.name.toLocaleLowerCase("tr-TR").includes(q)
    );
  }, [groups, search]);

  return (
    <div className="space-y-6">
      {/* TOP */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-100 text-2xl">
            💬
          </div>

          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              WhatsApp Grupları
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Gönderim segmentlerini yönet.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Grup ara..."
            className="h-11 w-56 rounded-2xl border border-gray-200 bg-white px-4 text-sm outline-none transition focus:border-green-500 dark:border-gray-700 dark:bg-gray-900"
          />

          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-green-600 px-5 text-sm font-medium text-white transition hover:bg-green-700"
          >
            + Yeni Grup
          </button>
        </div>
      </div>

      {/* STATS */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500">Toplam Grup</p>

          <h3 className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">
            {groups.length}
          </h3>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500">Aktif Segment</p>

          <h3 className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">
            {filtered.length}
          </h3>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500">Bugünkü İşlem</p>

          <h3 className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">
            —
          </h3>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500">Durum</p>

          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            Sistem Aktif
          </div>
        </div>
      </div>

      {/* GROUP LIST */}
      {loading ? (
        <div className="rounded-3xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900">
          Gruplar yükleniyor...
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((group) => (
            <div
              key={group.id}
              className="group rounded-3xl border border-gray-200 bg-white p-5 transition duration-200 hover:border-green-200 hover:shadow-lg dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                {/* LEFT */}
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-100 text-2xl">
                    👥
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {group.name}
                    </h3>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <div className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                        {group.memberCount || 0} kişi
                      </div>

                      <div className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                        Aktif
                      </div>

                      <span className="text-xs text-gray-400">
                        Son güncelleme bugün
                      </span>
                    </div>
                  </div>
                </div>

                {/* RIGHT */}
                <div className="flex gap-3">
                  <Link
                    href={"/admin/whatsapp/gruplar/" + group.id}
                    className="inline-flex h-11 items-center justify-center rounded-2xl bg-gray-900 px-5 text-sm font-medium text-white transition hover:bg-black dark:bg-white dark:text-black"
                  >
                    Kişileri Yönet
                  </Link>

                  <Link
                    href={"/admin/whatsapp/gonder?group=" + group.id}
                    className="inline-flex h-11 items-center justify-center rounded-2xl border border-gray-200 px-5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    Gönder
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE MODAL */}
      {showCreate && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-gray-900">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Yeni Grup
                </h3>

                <p className="mt-1 text-sm text-gray-500">
                  Yeni WhatsApp segmenti oluştur.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                ✕
              </button>
            </div>

            <div className="mt-6">
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Grup Adı
              </label>

              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Örn: İç Anadolu Bayileri"
                className="h-12 w-full rounded-2xl border border-gray-200 bg-white px-4 text-sm outline-none focus:border-green-500 dark:border-gray-700 dark:bg-gray-800"
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-gray-200 px-5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Vazgeç
              </button>

              <button
                type="button"
                onClick={createGroup}
                disabled={creating}
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-green-600 px-5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {creating ? "Oluşturuluyor..." : "Grubu Oluştur"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
