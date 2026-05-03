function hitungPenghasilan(golongan, jamLembur) {
    let gajiPokok = 0;
    let persenLembur = 0;

    // 1. Menentukan Gaji Pokok
    if (golongan.toUpperCase() === "A") {
        gajiPokok = 5000000;
    } else if (golongan.toUpperCase() === "B") {
        gajiPokok = 6500000;
    } else if (golongan.toUpperCase() === "C") {
        gajiPokok = 9500000;
    }

    // 2. Menentukan Persentase Lembur
    if (jamLembur === 1) {
        persenLembur = 0.30;
    } else if (jamLembur === 2) {
        persenLembur = 0.32;
    } else if (jamLembur === 3) {
        persenLembur = 0.34;
    } else if (jamLembur === 4) {
        persenLembur = 0.36;
    } else if (jamLembur >= 5) {
        persenLembur = 0.38;
    }

    // 3. Kalkulasi Total
    const gajiLembur = gajiPokok * persenLembur;
    const totalPenghasilan = gajiPokok + gajiLembur;

    // 4. Output Hasil
    console.log("--- Rincian Gaji ---");
    console.log("Golongan: " + golongan.toUpperCase());
    console.log("Gaji Pokok: Rp " + gajiPokok.toLocaleString('id-ID'));
    console.log("Jam Lembur: " + jamLembur + " Jam");
    console.log("Bonus Lembur: Rp " + gajiLembur.toLocaleString('id-ID'));
    console.log("--------------------");
    console.log("Total Akhir: Rp " + totalPenghasilan.toLocaleString('id-ID'));
}

// Menjalankan fungsi dengan contoh data
hitungPenghasilan("B", 3);
