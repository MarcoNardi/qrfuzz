import re
import os

#this will keep all the lines that contain the total difference (not the difference by dex file)
#make sure you remove ansi character color coding from the files 
def filter_total_diff_lines(input_file_path, output_file_path):
    with open(input_file_path, 'r') as infile, open(output_file_path, 'w') as outfile:
        for line in infile:
            if "total diff" in line:
                cleaned_line = re.sub(r'Output \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z:  ', '', line)
                outfile.write(cleaned_line)

def process_all_files_in_folder(folder_path):
    for filename in os.listdir(folder_path):
        if filename.endswith('.txt'):
            input_file_path = os.path.join(folder_path, filename)
            output_file_path = os.path.join(folder_path, f"cleaned_{filename}")
            filter_total_diff_lines(input_file_path, output_file_path)
            print(f"Cleaned file written to {output_file_path}")

# The script will process files in the current directory
folder_path = '.'

process_all_files_in_folder(folder_path)


