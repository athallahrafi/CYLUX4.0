import serial
import time
import sys
import os
from datetime import datetime

# ==================== KONFIGURASI ====================
SERIAL_PORT = '/dev/ttyUSB0'
BAUD_RATE = 115200
TARGET_FOLDER = "/home/alex/kuliah/SUPERHEATEAM1.0/CYLUX4.0/sensor_data/week1_july"
DURASI_MENIT = 2  
# =====================================================

# Menghitung total baris data yang dibutuhkan (1 detik = 4 data)
TOTAL_DATA_TARGET = DURASI_MENIT * 60 * 4 

def main():
    print("==================================================")
    print("   Aplikasi Perekam Data Turbiditas & Voltase     ")
    print(f"       (Otomatis Berhenti dalam {DURASI_MENIT} Menit)      ")
    print("==================================================")
    
    try:
        ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
        time.sleep(2)  # Jeda sinkronisasi awal
        ser.reset_input_buffer()
        print("Koneksi ke Arduino Berhasil!")
    except Exception as e:
        print(f"Gagal membuka port serial: {e}")
        sys.exit(1)
        
    print("\nTekan [ENTER] pada keyboard untuk MEMULAI perekaman data...")
    input()  
    
    if not os.path.exists(TARGET_FOLDER):
        os.makedirs(TARGET_FOLDER)
        
    timestamp_start = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = os.path.join(TARGET_FOLDER, f"turbid_{timestamp_start}.txt")
    
    print(f"Perekaman dimulai!")
    print(f"Data disimpan di: {filename}")
    print(f"Sistem akan merekam sebanyak {TOTAL_DATA_TARGET} data (Tepat 120 detik).\n")
    
    try:
        ser.write(b'S\n')  # Kirim sinyal start ke Arduino
    except Exception as e:
        print(f"Gagal kirim sinyal start: {e}")
        ser.close()
        sys.exit(1)
        
    baris_tercatat = 0
    detik_ke = 1
    
    print(f"Detik {detik_ke}:")
    
    try:
        with open(filename, 'w') as file:
            file.write("=== LOG DATA TURBIDITAS (SINKRON PER DETIK) ===\n")
            file.write("Format: [Index] Timestamp->Nilai Analog->Voltase\n\n")
            file.write(f"Detik {detik_ke}:\n")
            
            while True:
                if ser.in_waiting > 0:
                    line = ser.readline().decode('utf-8', errors='ignore').strip()
                    
                    if line and ',' in line:
                        current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
                        parts = line.split(',')
                        
                        if len(parts) == 2:
                            analog_val_str = parts[0].strip()
                            
                            try:
                                analog_val = int(analog_val_str)
                                voltase = (analog_val * 5.0) / 1023.0
                                voltase_str = f"{voltase:.3f}V"
                                
                                baris_tercatat += 1
                                
                                # Hitung index data di dalam detik tersebut (1 sampai 4)
                                index_dalam_detik = baris_tercatat % 4
                                if index_dalam_detik == 0:
                                    index_dalam_detik = 4
                                
                                # Menyusun format string teks data
                                data_tersinkron = f"{current_time}->{analog_val}->{voltase_str}"
                                teks_log_lengkap = f"  [{index_dalam_detik}] {data_tersinkron}"
                                
                                # 1. SIMPAN KE FILE .TXT
                                file.write(teks_log_lengkap + "\n")
                                file.flush() 
                                
                                # 2. TAMPILKAN DI TERMINAL
                                print(teks_log_lengkap)
                                
                                # CEK APAKAH TARGET 120 DETIK (480 DATA) SUDAH TERCAPAI
                                if baris_tercatat >= TOTAL_DATA_TARGET:
                                    print(f"\n[INFO] Target {DURASI_MENIT} menit tercapai (Tepat detik ke-120).")
                                    break # Keluar dari loop while secara otomatis
                                
                                # Jika data ke-4 di detik ini sudah tercatat, berpindah ke detik berikutnya
                                if baris_tercatat % 4 == 0:
                                    detik_ke += 1
                                    print(f"Detik {detik_ke}:")
                                    file.write(f"Detik {detik_ke}:\n")
                                    file.flush()
                                    
                            except ValueError:
                                pass
                                
    except KeyboardInterrupt:
        print(f"\n\nPerekaman diinterupsi manual pada Detik {detik_ke}.")
    finally:
        # Mengirim kode 'E' (End) ke Arduino agar OLED kembali ke status standby/stop
        try:
            ser.write(b'E\n')
        except:
            pass
        ser.close()
        print(f"\nPort Serial ditutup secara aman.")
        print(f"Selesai! Total data berhasil disimpan: {baris_tercatat} baris (Pas {baris_tercatat/4} detik).")

if __name__ == '__main__':
    main()